#!/usr/bin/env node
/**
 * blink1-server
 *
 *
 * @author Tod E. Kurt, http://todbot.com/blog
 *
 */

"use strict";

var Blink1 = require('node-blink1');
var parsecolor = require('parse-color');
var express = require('express');
var app = express();
app.set('json spaces', 4);

// morse code things
var morse = require('morse');
var MORSE_BLINK_TIME = .4;

var port = 8080;

var devices = Blink1.devices(); // returns array of serial numbers
var blink1 = null;
if( devices.length ) {
    blink1 = new Blink1();
}

var lastColor = '#000000';
var lastTime = 0;
var lastLedn = 0;
var lastRepeats = 0;

// rescan if we know we have no blink1
var blink1TryConnect = function() {
    if( blink1 ) { return; }
    devices = Blink1.devices();
    if( devices.length ) {
        blink1 = new Blink1();
    }
};

// Call blink1.fadeToRGB while dealing with disconnect / reconnect of blink1
var blink1Fade = function( millis, r, g, b, ledn ){
    blink1TryConnect();
    if( !blink1 ) { return "no blink1"; }
    try {
        blink1.fadeToRGB( millis, r, g, b, ledn );
    } catch(err) {
        blink1 = null;
        return ""+err;
    }
    return "success";
};

var blink1Blink = function( onoff, repeats, millis, r, g, b, ledn ) {
    // console.log("blink1Blink:", onoff, repeats, millis, r, g, b, ledn );
    if( onoff ) {
        blink1Fade( millis/2, r, g, b, ledn );
    } else {
        blink1Fade( millis/2, 0, 0, 0, ledn );
        repeats--;
    }
    onoff = !onoff;
    if( repeats ) {
        setTimeout( function() {
            blink1Blink(onoff, repeats, millis, r, g, b, ledn);
        }, millis );
    }
};

app.get('/blink1', function(req, res) {
    blink1TryConnect();
    var response = {
        blink1Connected: blink1 !== null,
        blink1Serials: devices,
        lastColor: lastColor,
        lastTime: lastTime,
        lastLedn: lastLedn,
        lastRepeats: lastRepeats,
        cmd: "info",
        code: morse.encode('Hello, world'),
        status: "success"
    };
    res.json( response );
});

var intervalBlink = function(time) {
    var color = parsecolor("#eeeeee");
    var rgb = color.rgb;
    blink1Blink( true, 1, time/2, rgb[0], rgb[1], rgb[2], 0);
};

var letterInterval = function(letter) {
    return (letter === "-") ? 2 : (letter === ".") ? 1 : 0;
};

app.get('/blink1/morse', function(req, res) {
    var message = req.query.message || "sos";
    var morseCode = morse.encode(message);
    var blinkTime = new Number(req.query.time || MORSE_BLINK_TIME) * 1000;
    var time = 0;
    intervalBlink(letterInterval(morseCode[0]) * blinkTime);
    for (var i = 1, len = morseCode.length; i < len; i++) {
        time += letterInterval((morseCode[i-1])) * blinkTime  || blinkTime;

        if (letterInterval(morseCode[i]) === 1) {
            setTimeout(function() {
                intervalBlink(blinkTime);
            }, time);
        } else if (letterInterval(morseCode[i]) === 2 ) {
            setTimeout(function() {
                intervalBlink(blinkTime * 2);
            }, time);
        }
    }

    var response = {
        code: morseCode,
        message: message,
        time: blinkTime / 1000,
        blink1Connected: blink1 !== null,
        blink1Serials: devices,
    }
    res.json(response);
});

app.get('/blink1/fadeToRGB', function(req, res) {
    var color = parsecolor(req.query.rgb);
    var time = Number(req.query.time) || 0.1;
    var ledn = Number(req.query.ledn) || 0;
    var status = "success";
    var rgb = color.rgb;
    if( rgb ) {
        lastColor = color.hex;
        lastTime = time;
        lastLedn = ledn;
        status = blink1Fade( time*1000, rgb[0], rgb[1], rgb[2], ledn );
    }
    else {
        status = "bad hex color specified " + req.query.rgb;
    }
    var response = {
        blink1Connected: blink1 !== null,
        blink1Serials: devices,
        lastColor: lastColor,
        lastTime: lastTime,
        lastLedn: lastLedn,
        lastRepeats: lastRepeats,
        cmd: "fadeToRGB",
        status: status
    };
    res.json( response );
});

app.get('/blink1/blink', function(req, res) {
    var color = parsecolor(req.query.rgb);
    var time = Number(req.query.time) || 0.1;
    var ledn = Number(req.query.ledn) || 0;
    var repeats = Number(req.query.repeats) || Number(req.query.count) || 3;
    var status = "success";
    var rgb = color.rgb;
    if( rgb ) {
        lastColor = color.hex;
        lastTime = time;
        lastLedn = ledn;
        lastRepeats = repeats;
        blink1Blink( true, repeats, time*1000, rgb[0], rgb[1], rgb[2], ledn );
    }
    else {
        status = "bad hex color specified " + req.query.rgb;
    }
    var response = {
        blink1Connected: blink1 !== null,
        blink1Serials: devices,
        lastColor: lastColor,
        lastTime: lastTime,
        lastLedn: lastLedn,
        lastRepeats: lastRepeats,
        cmd: "blink1",
        status: status
    };
    res.json( response );
});

// respond with "Hello World!" on the homepage
app.get('/', function(req, res) {
    res.send("<html>" +
        "<h2> Welcome to blink1-server</h2>" +
        "<p>" +
        "Supported URIs: <ul>" +
        "<li>   <code> /blink1 </code> " +
        " -- status info</li>" +
        "<li>   <code> /blink1/fadeToRGB?rgb=%23FF00FF&time=1.5&ledn=2 </code> " +
        "-- fade to a RGB color over time for led</li>" +
        "<li>   <code> /blink1/morse?message=hi&time=.3 </code> " +
        "-- send a morse code message</li>" +
        "</ul></p>" +
        "When starting server, argument specified is port to run on, e.g.:" +
        "<code> blink1-server 8080 </code>" +
        "</html>");
});


// if we have args
if( process.argv.length > 2 ) {
    var p = Number(process.argv[2]);
    port = (p) ? p : port;
}

var server = app.listen(port, function() {
    var host = server.address().address;
    var port = server.address().port;
    host = (host === '::' ) ? "localhost" : host;

    console.log('blink1-server listening at http://%s:%s/', host, port);
});
