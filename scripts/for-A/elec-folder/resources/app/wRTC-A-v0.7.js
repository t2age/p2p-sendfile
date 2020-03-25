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
var filePath = "dataOUT/";
var path = require('path');

var sourceFile;
var fileName = "";
var chunkArray = new Array();

var sourceFileSize;
var chunkSizeToRead = 16384;
var sourceBuffer = new Buffer.alloc(chunkSizeToRead);

var sourceOffset = 0;
const sourceBufferOFFSET = 0;

var Peer = require('./simplepeer.min.js')
var WebSocket = require('ws')

//const WEBSOCKET_ADDRESS = "localhost";        // all on the same machine, this is also the "ws-server.js"
const WEBSOCKET_ADDRESS = "127.0.0.1";				// all on same machine, this is also the "ws-server.js"
//const WEBSOCKET_ADDRESS = "192.168.200.200";      // use 2 machines, IP of the "ws-server.js"

var serverConn1;
serverConn1 = new WebSocket('ws://' + WEBSOCKET_ADDRESS + ':9000');
serverConn1.onmessage = gotMessageFromServer;

var peer1
peer1 = new Peer({ initiator: true, trickle: false })

function gotMessageFromServer(message) {
  var signal = JSON.parse(message.data);
  myConsoleHTML('--> Received From Server:');
  myConsoleHTML(JSON.stringify(signal.msg));  
  myConsoleHTML('');
  peer1.signal(signal.msg);
  
}

peer1.on('signal', data => {
  try {
    setTimeout(function() {
      serverConn1.send( JSON.stringify({'msg': data}) )
    }, 250);
  } catch (err) {
    myConsoleHTML(err)  
  }
})

peer1.on('connect', () => {
    myConsoleHTML('----------');
    myConsoleHTML('----------');

	var dataPack = JSON.stringify( {msg: 'Hello Peer2!', type: 'text', mark: 'in'} )
	peer1.send( dataPack )
})


peer1.on('data', data => {
  myConsoleHTML('Received message from Peer2: ' + data)
  if (data == 'closeItPlease#') {
    peer1.destroy()
    serverConn1.close()
  }
})

peer1.on('close', () => {
  myConsoleHTML('')
  myConsoleHTML('Connection with Peer2 is closed...');
  myConsoleHTML('----------');
  myConsoleHTML('----------');  
})

function myConsoleHTML(textMsg) {
	document.getElementById("display").value = document.getElementById("display").value + textMsg + "\n";
}
  
function sendFile (argFilename) {
	fileName = argFilename;
	
	// check if the file exist inside the data-out directory...
	if ( fs.existsSync( path.normalize( path.join( filePath, fileName) ) ) ) {
		// YES, proceed...
	} else {
		// NO, break execution...
		alert('File does NOT exist!');
		return;
	}

	sourceFile = fs.openSync( path.normalize( path.join( filePath, fileName ) ), 'r');	
    fs.fstat(sourceFile, function(err, stats) {
		sourceFileSize = stats.size;
		
		// send the name of the file about to be send...
	    var metadataPack = JSON.stringify( { type: 'meta', fname: fileName } );
	    peer1.send( metadataPack );
		
		while (sourceOffset < sourceFileSize) {

			// if there is less bytes to read than the chunkSizeToRead, then adjust
            if ((sourceOffset + chunkSizeToRead) > sourceFileSize) {
                chunkSizeToRead = (sourceFileSize - sourceOffset);
            }
            
            // read one chunkSizeToRead, place into buffer, at 0 position
            fs.readSync(sourceFile, sourceBuffer, sourceBufferOFFSET, chunkSizeToRead, sourceOffset);
			
			for (var i = 0; i < chunkSizeToRead; i++ ) {
				chunkArray.push ( sourceBuffer.readUIntBE(i, 1) );
			}
			 
			var dataPack = {"data":chunkArray};			
			chunkArray = [];

		    var dataPack = JSON.stringify( {msg: dataPack, type: 'file', mark: 'in'} )
		    peer1.send( dataPack )
		
            sourceOffset += chunkSizeToRead;
        
		}

		// close file...
		fs.close(sourceFile, function(){});
		sourceOffset = 0;
		sourceFile = null;
		chunkSizeToRead = 16384;
		
		// send file "END" mark, to signal all packs was sended...
		var dataPack = JSON.stringify( {msg: '', type: 'file', mark: 'end'} );
		peer1.send( dataPack );
		
		// send mediaPack msg...		
		var dataPack = JSON.stringify( {msg: 'Send new File: ' + fileName, type: 'text'} )
		peer1.send( dataPack );
			
    });		//end of fs.stat
 	  
}; // END sendFile

