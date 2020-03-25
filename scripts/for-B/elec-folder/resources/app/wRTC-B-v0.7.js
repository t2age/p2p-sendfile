// Version: v0.7
// Date: 2020/Mar
// Tested with NodeJS: v10.16.3
// Tested in x86 PC Linux, RPI3, Armbian Bionic
//
// Need to install:
//    npm install ws
//
// Need to download SimplePeer JS lib (simplepeer.min.js)
//
//
// How to Use (need 3 terminals shell):
//    1. run: node ws-server.js
//    2. run: ./electron (on Peer B)
//    3. run: ./electron (on Peer A)
//

var fs = require("fs");

var filePath = "dataIN/";

var rcvFilename = "";
var path = require('path');
var lastFileName = "";

var Peer = require('./simplepeer.min.js')		// file is in current folder
var WebSocket = require('ws')		// needed inside node_modules

//const WEBSOCKET_ADDRESS = "localhost";        // all on the same machine, this is also the "ws-server.js"
const WEBSOCKET_ADDRESS = "127.0.0.1";				// all on same machine, this is also the "ws-server.js"
//const WEBSOCKET_ADDRESS = "192.168.200.200";      // use 2 machines, IP of the "ws-server.js"

var serverConn2;
serverConn2 = new WebSocket('ws://' + WEBSOCKET_ADDRESS + ':9000');
serverConn2.onmessage = gotMessageFromServer2;

var peer2
peer2 = new Peer({ initiator: false, trickle: false })

function gotMessageFromServer2(message) {
  var signal = JSON.parse(message.data);
  myConsoleHTML('--> Received From Server:');
  myConsoleHTML(JSON.stringify(signal.msg));
  myConsoleHTML('');
  peer2.signal(signal.msg);
}

peer2.on('signal', data => {
  try {
    serverConn2.send( JSON.stringify({'msg': data}) )
  } catch (err) {
    myConsoleHTML(err)  
  }

})

peer2.on('connect', () => {
  myConsoleHTML('----------');
  myConsoleHTML('----------');
})

peer2.on('data', data => {
	var dataPackage = JSON.parse(data);
	if (dataPackage.type === 'meta') {
		// receive the name of the file here... 
		rcvFilename = dataPackage.fname;	
		recFileNameSuffix = getDate() + '-' + getTime();	
	}
	
	if (dataPackage.type === 'file') {
		var dataMark = dataPackage.mark;
		if (dataMark == 'end') {
			// This is the last pack of the receiving file...
			lastFileName = '';			
				
		} else {
			// Receive new pict file here...
			var dataPack = dataPackage.msg;
			// convert to array, to buffer, write file...
			var recArray = dataPack.data;	
			dataPack = null;			
	
			var outBuffer = new Buffer.alloc( recArray.length );
			for (var i = 0; i < recArray.length; i++) {
			        outBuffer[i] = recArray[i];
			}
						
			// append all chunks to a file
			var theFileName = path.join( filePath, rcvFilename );
			theFileName = path.normalize( theFileName ) + "-" + recFileNameSuffix;
			lastFileName = theFileName;
	
			fs.appendFileSync(theFileName, outBuffer, function (err) {
				if (err) throw err;
		    });	
		}
	
	// end of type: file  
	} else {
		if (dataPackage.type === 'text') {
			myConsoleHTML('Received message from Peer1: ' + dataPackage.msg)
			peer2.send('Hello Peer1, how are you?')		
		}
	}
  
})

peer2.on('close', () => {
	myConsoleHTML('')
	myConsoleHTML('Connection with Peer1 is closed...');
	serverConn2.close();
	myConsoleHTML('----------');
	myConsoleHTML('----------'); 
})

function myConsoleHTML(textMsg) {
	document.getElementById("display").value = document.getElementById("display").value + textMsg + "\n";
}

function getDate() {
    var date = new Date();

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + "" + month + "" + day;
}

function getTime() {
    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var milli  = date.getMilliseconds();
    sec = (sec < 10 ? "0" : "") + sec;

    return hour + "" + min + "" + sec + "-" + milli;
}

