// Version: v0.8
// Date: 2020/Mar
// Tested with NodeJS: v10.16.3
// Tested in x86 PC Linux, RPI3
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

var packArrived = true;	// used to hold status from Peer B...
var packCounter;

/* -------------------------------------------------------------------
 * Speed of Transfer and PROBLEMS.
 * Following 2 variables can be adjusted if you encounter errors in
 * data transfering...
 * 
 * maxPackInTransit is the number of packs that is transmitted at once,
 * then, a signal from the receiver is needed to trigger another
 * sequence of packs... you can adjust it to low if problem happens...
 * 
 * delayChunk is the time, in milliseconds to wait between the
 * transmission of 2 packs, the lower the number the faster the rate
 * of transmission...
 * Slow network conditions may require higher numbers...
 * Faster networks, numbers can go slow...
 * -------------------------------------------------------------------
 */
var maxPackInTransit = 75;		// number of packs in transit state...
var delayChunk = 75;			// delay in milliseconds between sending packs...


var fs = require("fs");
var filePath = "dataOUT/";
var path = require('path');

var sourceFile;
var fileName = "";
var chunkArray = new Array();

var sourceFileSize;
var chunkSizeToRead = 16384;
var sourceBuffer = new Buffer.alloc(chunkSizeToRead);

var buffer = new Buffer.alloc(chunkSizeToRead);

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
	var dataPackage = JSON.parse(data);
	if (dataPackage.type === 'text') {
		myConsoleHTML('Received message from Peer2: ' + dataPackage.msg);
		return;		
	}
	if (dataPackage.type === 'rcvOK') {
		packArrived = true;
		//console.log("one rcvOK");
		return;		
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
 
/*
 * 2020-MAR
 * The "sendFile()" function below is a simplification of another function
 * "sendBIGFile()", created for the "Tutorial P2P Send File".
 * It can only handle small files, few hundred kilos to 1 mega byte...
 * 
 * From the tutorial point of view, learning the simplified version
 * will allow the user to understand the basic principles...
 * From here, if there is a desire to send files of bigger sizes,
 * Use and explore the code of the "sendBIGFile()" function,
 * also present in this file...
 * 
 */ 
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
        
			
			// perhaps a while here, holding the execution until a recPackOK is received from peerB...
			//while (packArrived === false) { 
				// keep here until signal from peerB...
				//await sleep(500);
			//}
			packArrived = false;
			
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


/*
 * 2020-MAR
 * This "sendBIGFile()" function can send files bigger than 1MB... 
 * It was created some years ago to send files around ~30MB
 * Tests shows that it can send files of multi GIGAbytes...
 * 
 * Depending of the system and the network, adjusts will
 * be required to operate without problems...
 * 
 * The delay between packs
 * The number of packs in transit
 * Also, at more granular level, maybe even change the size
 * of each pack (or chunk)
 * 
 * The simplified version "sendFile()" was created specifically
 * for the Tutorial "P2P Send File", and it cannot handle files
 * bigger than around 1MB... maybe even less than 1MB...
 * 
 * Technical Detail:
 * The original version of this routine (function) was created
 * to be used with "Pure" WebRTC code, without the use of the
 * SimplePeer.min.js, some years ago...
 * Now, it is adapted to work with the SimplePeer.min.js module.
 * The thinking at present time (2020-Mar) is to change it further
 * to work with SimplePeer Module, and to improve it with
 * some capability to sense the actual performance of the network,
 * and self adjusts the transfer speed factors so that always
 * achieve the highest speed possible...
 * Also, this current version need some fault-tolerant mechanism,
 * so that, if an interruption happens in the middle of a transmission,
 * some process of recovering and completing can take place, without
 * losing the data that already is transmitted...
 * These desired improvements will, of course, make the code bigger and
 * add some complex details, departing away from a pure tutorial code
 * and moving in the direction of a fully practical code...
 * 
 */
function sendBigFile(theTargetFileName) {
packCounter = 0;
document.getElementById('sendBigFile').disabled = true;
	
var htmlFileName = document.getElementById('fileName');
htmlFileName.value = theTargetFileName;
fileName = theTargetFileName;

if (theTargetFileName == '') {
	alert('Need a file name to transfer...');
	return;
}

// check if the file exist inside the data-out directory...
if ( fs.existsSync( path.normalize( path.join( filePath, fileName ) ) ) ) {
	// YES
	//alert('YES');
	
} else {
	// NO
	alert('File does NOT exist!');
	return;
	}

// update sendStatus
var sendStatus = document.getElementById('sendStatus');
sendStatus.value = 'Sending...';	

var htmlChunkSize = document.getElementById('chunkSize');
htmlChunkSize.value = chunkSizeToRead;

var htmlDelayChunk = document.getElementById('delayChunk');
htmlDelayChunk.value = delayChunk;

var htmlMaxPackInTransit = document.getElementById('maxPackInTransit');
htmlMaxPackInTransit.value = maxPackInTransit;

sourceFile = fs.openSync( path.normalize( path.join( filePath, fileName ) ), 'r');
	
    fs.fstat(sourceFile, function(err, stats) {

		sourceSize = stats.size;

		// get file size here...
		var displayFileSize = document.getElementById('fileSize');
		displayFileSize.value = sourceSize;
		
		var packNumber = Math.ceil( sourceSize / chunkSizeToRead );

		var displayPackNumber = document.getElementById('sendPackNumber');
		displayPackNumber.value = packNumber;

	    var sendProgress = document.getElementById('mysendProgress');
	    sendProgress.max = packNumber;
	    sendProgress.value = 0;		
		
		// send file metadata here...
	    var metadataPack = JSON.stringify( {
											type: 'pack-file-metadata',
											targetFileName: fileName,
											targetFileSize: sourceSize,
											targetPackNumber: packNumber,
											targetMaxPackInTransit: maxPackInTransit
											} );
	    peer1.send( metadataPack );
		
		// delay a little bit before sending...
		sleep(750, function() {});

		// invoke the first packDove here...
		setTimeout(function() {doveONE()}, 200);
		         
    });		//end of fs.stat
    
}

function doveONE() {
        if (packArrived) {
			packCounter = packCounter + 1;
			if (packCounter > maxPackInTransit) {
				packCounter = 0;
				packArrived = false;
			}
		} else {
			// invoke doveTWO()
			setTimeout(function() {doveTWO()}, delayChunk);
			return;
		}	
	
			// if there is less bytes to read than the chunkSizeToRead, then adjust
            if ((sourceOffset + chunkSizeToRead) > sourceSize) {
                chunkSizeToRead = (sourceSize - sourceOffset);
            }
            
            // read one chunkSizeToRead, place into buffer, at 0 position
            fs.readSync(sourceFile, buffer, sourceBufferOFFSET, chunkSizeToRead, sourceOffset);
			
			for (var i = 0; i < chunkSizeToRead; i++ ) {
				chunkArray.push ( buffer.readUIntBE(i, 1) );
			}
			 
			var dataPack = {"data":chunkArray};			
			chunkArray = [];

		    var dataPack = JSON.stringify( {message: dataPack, type: 'pack-file'} )
		    //packArriveOK = false;
		    peer1.send( dataPack )
	    
			// update progress bar
			var sendProgress = document.getElementById('mysendProgress');
			sendProgress.value = sendProgress.value + 1;		
			
            sourceOffset += chunkSizeToRead;
        
        if (sourceOffset < sourceSize) {
			// invoke doveTWO()
			setTimeout(function() {doveTWO()}, delayChunk);
		} else {
			// close file descriptor...
			fs.close(sourceFile, function(){});
			sourceOffset = 0;
			sourceFile = null;
			chunkSizeToRead = 16384;

			console.log("Transmission completed!");

			// update sendStatus
			var sendStatus = document.getElementById('sendStatus');
			sendStatus.value = 'Transmission completed!';	
			
			document.getElementById('sendBigFile').disabled = false;		
		}

}

function doveTWO() {
        if (packArrived) {
			packCounter = packCounter + 1;
			if (packCounter > maxPackInTransit) {
				packCounter = 0;
				packArrived = false;
			}
		} else {
			// invoke doveTWO()
			setTimeout(function() {doveONE()}, delayChunk);
			return;
		}	

			// if there is less bytes to read than the chunkSizeToRead, then adjust
            if ((sourceOffset + chunkSizeToRead) > sourceSize) {
                chunkSizeToRead = (sourceSize - sourceOffset);
            }
            
            // read one chunkSizeToRead, place into buffer, at 0 position
            fs.readSync(sourceFile, buffer, sourceBufferOFFSET, chunkSizeToRead, sourceOffset);
			
			for (var i = 0; i < chunkSizeToRead; i++ ) {
				chunkArray.push ( buffer.readUIntBE(i, 1) );
			}
			 
			var dataPack = {"data":chunkArray};			
			chunkArray = [];

		    var dataPack = JSON.stringify( {message: dataPack, type: 'pack-file'} )
		    //packArriveOK = false;
		    peer1.send( dataPack )
	    
			// update progress bar
			var sendProgress = document.getElementById('mysendProgress');
			sendProgress.value = sendProgress.value + 1;
			
            sourceOffset += chunkSizeToRead;
        
        if (sourceOffset < sourceSize) {
			// invoke doveONE()
			setTimeout(function() {doveONE()}, delayChunk);
		} else {
			// close file descriptor
			fs.close(sourceFile, function(){});
			sourceOffset = 0;
			sourceFile = null;
			chunkSizeToRead = 16384;
			
			console.log("Transmission completed!");
			
			// update sendStatus
			var sendStatus = document.getElementById('sendStatus');
			sendStatus.value = 'Transmission completed!';

			document.getElementById('sendBigFile').disabled = false;					
		}
	
}

function sleep(time, callback) {
    var stop = new Date().getTime();
    while(new Date().getTime() < stop + time) {
    }  
    callback();
}

