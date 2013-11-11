// Configuration
var APP_NAME = 'slpc-record';
var MONGODB_URI = process.env.MONGOLAB_URI || 'mongodb://localhost/' + APP_NAME;
var HTTP_PORT = process.env.PORT || 5000;
var TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
var TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

var TWILIO_NUMBER = {
  'en': process.env.TWILIO_NUMBER_EN,
  'es': process.env.TWILIO_NUMBER_ES
};

var RECORD_NUMBER = {
  'en': process.env.RECORD_NUMBER_EN,
  'es': process.env.RECORD_NUMBER_ES
};

var STEALTH_NUMBER = {
  'en': process.env.STEALTH_NUMBER_EN,
  'es': process.env.STEALTH_NUMBER_ES
};

var PLAYBACK_NUMBER = {
  'en': process.env.PLAYBACK_NUMBER_EN,
  'es': process.env.PLAYBACK_NUMBER_ES
};

// Initialize i18n
var i18n = require("i18n-2");

// Initialize express
var express = require('express');
var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.logger());
app.use(express.bodyParser());
i18n.expressBind(app, {
  'locales': ['en', 'es'],
  'query': true
  // 'setLocaleFromSubdomain': true
});
app.use(app.router);
app.use(express.methodOverride());
app.use(express.static(__dirname + "/public"));

// Initialize mongoose
var mongoose = require('mongoose');
console.log("Connecting to MongoDB server on " + MONGODB_URI);
mongoose.connect(MONGODB_URI);

// Initialize twilio
var twilio = require('twilio');
var twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Initialize moment
var moment = require('moment');

// Models
var recordingSchema = new mongoose.Schema({
  'from': String,
  'to': String,
  'date': {type: Date, default: Date.now},
  'callSid': String,
  'url': String,
  'duration': Number
});
recordingSchema.methods.prettyDate = function(locale) {
  return moment(this.date).lang('en').format("dddd MMMM D YYYY hh:mm A");
};
var Recording = mongoose.model('Recording', recordingSchema);

var getSingleParam = function(param) {
  return Array.isArray(param) ? from : param;
};

var getRecordingFromParams = function(params) {
  return {
    'from': getSingleParam(params.From),
    'to': getSingleParam(params.To),
    'callSid': getSingleParam(params.CallSid),
    'url': getSingleParam(params.RecordingUrl),
    'duration': getSingleParam(params.RecordingDuration)
  };
};

var formatDuration = function(seconds) {

}

// Playback
app.post('/playback/', function(req, res){
  var from = getSingleParam(req.body.From);

  Recording.find({'from': from}, function(error, recordings) {
    res.render('playback/index', {'recordings': recordings});
  });
});

app.post('/playback/error', function(req, res){
  var from = getSingleParam(req.body.From);

  Recording.find({'from': from}, function(error, recordings) {
    res.render('playback/error', {'recordings': recordings});
  });
});

app.post('/playback/input', function(req, res){
  var from = getSingleParam(req.body.From);
  var digits = getSingleParam(req.body.Digits);

  Recording.find({'from': from}, function(error, recordings) {
    var index = parseInt(digits, 10) - 1;
    if (index >= 0 && index < recordings.length) {
      res.render('playback/play', {'recordings': recordings, 'index': index});
    } else if (index == -1) {
      res.render('playback/list', {'recordings': recordings});
    } else {
      res.render('playback/error', {'recordings': recordings});
    }
  });
});

// Record
app.post('/record/', function(req, res){
  res.render('record/index');
});

app.post('/record/finish', function(req, res){
  var from = getSingleParam(req.body.From);
  Recording.count({'from': from}, function(error, count) {
    var recording = getRecordingFromParams(req.body);
    console.log("Creating recording: " + JSON.stringify(recording));
    Recording.create(recording);

    console.log("Sending message...");
    var locale = req.i18n.getLocale();
    twilioClient.sendMessage({
      'to': recording.from,
      'from': TWILIO_NUMBER[locale],
      'body': req.i18n.__('You made a new recording. To play back the recording, call %s and press %s#', TWILIO_NUMBER[locale], count + 1)
    });
  });

  res.render('record/finish');
});

// Stealth
app.post('/stealth/', function(req, res){
  res.render('stealth/index');
});

app.post('/stealth/finish', function(req, res){
  var recording = getRecordingFromParams(req.body);
  console.log("Creating recording: " + JSON.stringify(recording));
  Recording.create(recording);

  res.render('stealth/finish');
});

// Recordings
app.get('/recordings/', function(req, res){
  var number = req.query.number;
  var cleanNumber = "+1" + number.replace(/\D/g, '');
  Recording.find({"from": cleanNumber}, function(error, recordings) {
    res.render('web/recordings', {'number': number, 'recordings': recordings});
  });
});

// Instructions
app.get('/', function(req, res){
  var locale = req.i18n.getLocale();
  console.log("Locale: " + locale);
  res.render('web/index', {
    'recordNumber': RECORD_NUMBER[locale],
    'stealthNumber': STEALTH_NUMBER[locale],
    'playbackNumber': PLAYBACK_NUMBER[locale]
  });
});

console.log("Starting server on http://localhost:" + HTTP_PORT);
app.listen(HTTP_PORT);
