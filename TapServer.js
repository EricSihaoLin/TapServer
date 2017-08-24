var config = require('./config.json');
var mysql = require('mysql');
var io = require('socket.io')(3000);

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

var clientTapList = [];

var conn = 0;

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
	
	console.log('[Info] Connected to Tap Access DB with session ID ' + tap.threadId);
});
console.log('[Info] Database connection established');

function logTap(status, rfid, name, netid, station, notes){
	var logQuery = "INSERT INTO client_access_log (status, rfid, name, netid, notes, station) VALUES ('" + status + "', '" + rfid + "', '" + name + "', '" + netid + "', '" + notes + "', '" + station + "')";
	tap.query(logQuery);
}


//Initialize Core Functions
function onTap(data, socket){
	console.log('[Info] Validating ' + data.rfid);
	var queryString = 'SELECT * FROM user_rfid WHERE rfid = ' + data.rfid;
	rfid.query(queryString, function(err, rows, fields) {
		if (err) throw err;
		if (!rows.length){
			io.emit('deny', {name: "", netid: "", notes: "Invalid ID"});
			logTap("Denied", data.rfid, "", "", data.station, "Invalid ID");
			console.log('[Info] Denying ' + data.rfid);
		}
		if (rows.length == 1){
			if (rows[0].eduPersonPrimaryAffiliation === "student"){
				if(rows[0].affiliationSubtype.indexOf("degree") !== -1){
					io.emit('accept', {name: rows[0].cn, netid: rows[0].uid, notes: "Current Degree Student", station: data.station});
					logTap("Accepted", data.rfid, rows[0].cn, rows[0].uid, data.station, "Current Degree Student");
					console.log('[Info] Accepting ' + data.rfid);
				}
				else{
					io.emit('deny', {name: rows[0].cn, netid: rows[0].uid, notes: "Not Current Degree Student", station: data.station});
					logTap("Denied", data.rfid, rows[0].cn, rows[0].uid, data.station, "Not Current Degree Student");
					console.log('[Info] Denying ' + data.rfid);
				}
			}
			else if (rows[0].eduPersonPrimaryAffiliation === "employee"){
				if(rows[0].division.indexOf("NYU IT") !== -1){
					io.emit('accept', {name: rows[0].cn, netid: rows[0].uid, notes: "Current NYU IT Employee", station: data.station});
					logTap("Accepted", data.rfid, rows[0].cn, rows[0].uid, data.station, "Current NYU IT Employee");
					console.log('[Info] Accepting ' + data.rfid);
				}
				else{
					if(rows[0].affiliationSubtype.indexOf("administrator") !== -1){
						io.emit('deny', {name: rows[0].cn, netid: rows[0].uid, notes: "Administrative Staff No Access", station: data.station});
						logTap("Denied", data.rfid, rows[0].cn, rows[0].uid, data.station, "Administrative Staff No Access");
						console.log('[Info] Denying ' + data.rfid);
					}
					else{
						io.emit('accept', {name: rows[0].cn, netid: rows[0].uid, notes: "Current Employee", station: data.station});
						logTap("Accepted", data.rfid, rows[0].cn, rows[0].uid, data.station, "Current Employee");
						console.log('[Info] Accepting ' + data.rfid);
					}
				}
			}
			else if (rows[0].eduPersonPrimaryAffiliation === "faculty"){
				io.emit('accept', {name: rows[0].cn, netid: rows[0].uid, notes: "Current Faculty", station: data.station});
				logTap("Accepted", data.rfid, rows[0].cn, rows[0].uid, data.station, "Current Faculty");
				console.log('[Info] Accepting ' + data.rfid);
			}
			else if (rows[0].eduPersonPrimaryAffiliation === "alum"){
				io.emit('deny', {name: rows[0].cn, netid: rows[0].uid, notes: "Alumni No Access", station: data.station});
				logTap("Denied", data.rfid, rows[0].cn, rows[0].uid, data.station, "Alumni No Access");
				console.log('[Info] Denying ' + data.rfid);
			}
		}
		else
		{
			io.emit('deny', {name: "", netid: "", notes: "RFID Collision", station: data.station});
			logTap("Denied", data.rfid, "", "", data.station, "RFID Collision");
			console.log('[Info] Denying ' + data.rfid);
		}
	});
}



console.log('[Info] Ready for connections on 3000');
io.on('connection', function (socket) {
	conn++;
	console.log('[Info] Socket connected, current active sockets: ' + conn);
	
	socket.on('rfid', function (id) { 
		console.log('[Info] RFID Data Received: ' + id);
		onTap(id, io, rfid, tap);
	});
	
	socket.on('disconnect', function () { 
		conn--;
		console.log('[Info] Socket disconnected, current active sockets: ' + conn);
		});
});
