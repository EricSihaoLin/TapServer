//Required modules
var config = require('./config.json');
var mysql = require('mysql');
var io = require('socket.io')(3000);

//Static database credentials
//Please change credentials in config.json
var rfid = mysql.createConnection({
	host: config.rfid_database_host,
	user: config.rfid_database_user,
	database: config.rfid_database_table,
	password: config.rfid_database_password
})
var tap = mysql.createConnection({
	host: config.tap_database_host,
	user: config.tap_database_user,
	database: config.tap_database_table,
	password: config.tap_database_password
})

//Global variable declaration
var clientTapList = [];
var conn = 0;

//Global logging 
function logInfo(message) {
	console.log('[Info] ' + message);
}

function logErr(message) {
	console.error('[Error] ' + message);
}

//Initialize DB connection to RFID
rfid.connect(function(err){
	if(err){
		logErr('Failed to connect to RFID Database: ' + err.stack);
		return;
	}
	
	logInfo('Connected to RFID DB with session ID ' + rfid.threadId);
});
//Initialize DB connection to Tap Access
tap.connect(function(err){
	if(err){
		logErr('Failed to connect to Tap Access Database: ' + err.stack);
		return;
	}
	
	logInfo('Connected to Tap Access DB with session ID ' + tap.threadId);
});
logInfo('Database connection established');



function logTap(status, name, netid, station, notes){
	var logQuery = "INSERT INTO client_access_log (status, name, netid, notes, station) VALUES ('" + status + "', '" + name + "', '" + netid + "', '" + notes + "', '" + station + "')";
	tap.query(logQuery);
}


//Initialize Core Functions
function onTap(data, socket){
	logInfo('Validating ' + data.rfid);
	var queryString = 'SELECT * FROM user_rfid WHERE rfid = ' + data.rfid;
	rfid.query(queryString, function(err, rows, fields) {
		if (err) throw err;
		if (!rows.length){
			io.emit('deny', {name: "", netid: "", notes: "Invalid ID / No ID Entry Found"});
			logTap("Denied", "", "", data.station, "Invalid ID / No ID Entry Found for " + data.rfid);
			logInfo('Denying ' + data.rfid);
		}
		else if (rows.length == 1){
			if (rows[0].eduPersonPrimaryAffiliation === "student"){
				if(rows[0].affiliationSubtype.indexOf("degree") !== -1){
					io.emit('accept', {name: rows[0].cn, netid: rows[0].uid, notes: "Current Degree Student", station: data.station});
					logTap("Accepted", rows[0].cn, rows[0].uid, data.station, "Current Degree Student");
					logInfo('Accepting ' + data.rfid);
				}
				else{
					io.emit('deny', {name: rows[0].cn, netid: rows[0].uid, notes: "Not Current Degree Student", station: data.station});
					logTap("Denied", rows[0].cn, rows[0].uid, data.station, "Not Current Degree Student");
					logInfo('Denying ' + data.rfid);
				}
			}
			else if (rows[0].eduPersonPrimaryAffiliation === "employee"){
				if(rows[0].division.indexOf("NYU IT") !== -1){
					io.emit('accept', {name: rows[0].cn, netid: rows[0].uid, notes: "Current NYU IT Employee", station: data.station});
					logTap("Accepted", rows[0].cn, rows[0].uid, data.station, "Current NYU IT Employee");
					logInfo('Accepting ' + data.rfid);
				}
				else{
					if(rows[0].affiliationSubtype.indexOf("administrator") !== -1){
						io.emit('deny', {name: rows[0].cn, netid: rows[0].uid, notes: "Administrative Staff No Access", station: data.station});
						logTap("Denied", rows[0].cn, rows[0].uid, data.station, "Administrative Staff No Access");
						logInfo('Denying ' + data.rfid);
					}
					else{
						io.emit('accept', {name: rows[0].cn, netid: rows[0].uid, notes: "Current Employee", station: data.station});
						logTap("Accepted", rows[0].cn, rows[0].uid, data.station, "Current Employee");
						logInfo('Accepting ' + data.rfid);
					}
				}
			}
			else if (rows[0].eduPersonPrimaryAffiliation === "faculty"){
				io.emit('accept', {name: rows[0].cn, netid: rows[0].uid, notes: "Current Faculty", station: data.station});
				logTap("Accepted", rows[0].cn, rows[0].uid, data.station, "Current Faculty");
				logInfo('Accepting ' + data.rfid);
			}
			else if (rows[0].eduPersonPrimaryAffiliation === "alum"){
				io.emit('deny', {name: rows[0].cn, netid: rows[0].uid, notes: "Alumni No Access", station: data.station});
				logTap("Denied", rows[0].cn, rows[0].uid, data.station, "Alumni No Access");
				logInfo('Denying ' + data.rfid);
			}
		}
		else
		{
			io.emit('deny', {name: "", netid: "", notes: "RFID Collision", station: data.station});
			logTap("Denied", "", "", data.station, "RFID Collision " + data.rfid);
			logInfo('Denying ' + data.rfid);
		}
	});
}



logInfo('Ready for connections on 3000');
io.on('connection', function (socket) {
	conn++;
	logInfo('Socket connected, current active sockets: ' + conn);
	
	socket.on('rfid', function (data) { 
		logInfo('RFID Data Received: ' + data.rfid);
		onTap(data, io);
	});
	
	socket.on('disconnect', function () { 
		conn--;
		logInfo('Socket disconnected, current active sockets: ' + conn);
		});
});
