var config = require('./config.json')
var mysql = require('mysql')
var io = require('socket.io').listen(3000)
var rfid = mysql.createConnection({
	host: config.rfid_database_host,
	user: config.rfid_database_user,
	database: config.rfid_database_table,
	password: config.rfid_database_password
})
var tap = mysql.createConnection({
	host: tap.rfid_database_host,
	user: tap.rfid_database_user,
	database: tap.rfid_database_table,
	password: tap.rfid_database_password
})

var monitorCount = 0
var socketCount = 0;
var hasInitialized = false
//NetID list for today's new users
var clientTapList = []

//Initialize DB connection to RFID
rfid.connect(function(err){
	if(err){
		console.error('[Error] Failed to connect to RFID Database: ' + err.stack);
		return;
	}
	
	console.log('[Info] Connected to RFID DB with session ID ' + rfid.threadId);
});
//Initialize DB connection to Tap Access
tap.connect(function(err){
	if(err){
		console.error('[Error] Failed to connect to Tap Access Database: ' + err.stack);
		return;
	}
	
	console.log('[Info] Connected to Tap Access DB with session ID ' + rfid.threadId);
});

//Initialize Socket.IO Handlers
io.of('station').on('connection', onStationConnect)
io.of('station').on('disconnect', onStationDisconnect)

io.of('monitor').on('connection', onMonitorConnect)
io.of('monitor').on('disconnect', onMonitorDisconnect)


//Socket.IO handler functions
function onStationConnect(socket){
	socket.on('verify tap')
}



// Initialize socket.io connection handlers
io.sockets.on('connection', function(socket)){
	//New socket connection, increase socket count
	monitorCount++;
	//Let all sockets know how many devices are currently online
	io.socket.emit('monitors connected', socketCount)
	
	socket.on('disconnect', function(){
	    //Update current count to all users
	    socketCount--
	    io.socket.emit('user connected', socketCount)	
	})
	
	
})

