#!/usr/bin/env node
import got from 'got';
import { EventEmitter } from "events";
import http from 'http';
import https from 'https';
import api from './api.js';
//'use strict';


// get environment variable
var args = process.argv.slice(2);
var port = 4040;
if(process.env.PROBE_SERVER_PORT) {
	port = process.env.PROBE_SERVER_PORT;
}

// start server
const server = api.listen(port, '0.0.0.0', () => {
	console.log('Express server listening on port ' + port);
	loop(args[0]); // start controller loop
});
server.keepAliveTimeout = 15000; // 15 seconds

// Log connections
server.on('connection', function(socket) {
	let socketId = '<' + socket.localAddress + ':' + socket.localPort + '-' + socket.remoteAddress + ':' + socket.remotePort;
	console.log('Client requested SYN - open new incoming connection');
	console.log('Client Socket OPEN: [' + socketId + ']');

	// create new socket
	createSocketEntry(socketId, socket);

	// on timeout
	socket.on('timeout', () => {
		console.log('Socket timed out: ' + socket.timeout);
		deleteSocketEntry(socketId);
	});

	// Server ends connection if Client requests it - FIN
	socket.on('end', () => {
		console.log('Client requested FIN - closing connection');
		console.log('Client Socket CLOSE: [' + socketId + ']');
		deleteSocketEntry(socketId);
	});

	// errors
	socket.on('error', (err) => {
		console.error('Socket error: ' + err);
		deleteSocketEntry(socketId);
	});
});

// sleep function
async function sleep(ms) {
	return new Promise(res => setTimeout(res, ms));
}

// main loop
function initAgents() {
	// custom agent using class-embedded-emitter
	class myAgent extends http.Agent {
		createConnection(options, callback) {
			let socket = http.Agent.prototype.createConnection.call(this, options, callback);
			this.emit('createSocket', options['_agentKey'], socket);
			socket.on('lookup', (err, address, family, hostname) => {
				this.emit('lookupSocket', options['_agentKey'], socket, hostname, address);
			});
			socket.on('connect', () => {
				this.emit('connectSocket', options['_agentKey'], socket);
			});
			socket.on('end', () => {
				this.emit('deleteSocket', options['_agentKey'], socket);
			});
			return socket;
		}
	}

	// initialise persistence options
	const liveOption = {
		keepAlive: true,
		//maxFreeSockets: 2  // per-origin socket maximum - default: 256
		maxSockets: 1  // global socket pool maximum - default: Infinity
	};
	const httpAgent = new myAgent(liveOption);
	const httpsAgent = new https.Agent(liveOption);

	// set up listeners
	httpAgent.on('createSocket', (key, socket) => {
		let target = key.replace(/(:$)/g, '');
	});
	httpAgent.on('deleteSocket', (key, socket) => {
		let target = key.replace(/(:$)/g, '');
		let socketId = '>' + socket.localAddress + ':' + socket.localPort + '-' + socket.remoteAddress + ':' + socket.remotePort;
		console.log('http.Agent deleteSocket: [' + socketId + ']');
		deleteSocketEntry(socketId);
	});
	httpAgent.on('connectSocket', (key, socket) => {
		let target = key.replace(/(:$)/g, '');
		let socketId = '>' + socket.localAddress + ':' + socket.localPort + '-' + socket.remoteAddress + ':' + socket.remotePort;
		console.log('http.Agent connectSocket KEY: ' + socketId);
		createSocketEntry(socketId, socket);
	});
	httpAgent.on('lookupSocket', (key, socket, hostname, address) => {
		let target = key.replace(/(:$)/g, '');
		console.log('http.Agent lookupSocket [' + hostname + '] -> [' + address + ']');
	});

	// return agents
	return {
		http: httpAgent,
		https: httpsAgent
	};
}

async function loop(name) {
	const agent = initAgents();
	const nodeId = api.model.newId(); // create id for this node
	console.log('SERVER instance lanched with id[ ' + nodeId + ' ]');
	api.model['nodeId'] = nodeId;
	if(typeof(name) == 'undefined') {
		name = 'router';
	}
	api.model.routes.update(nodeId, 'local', name);

	// begin loop
	while(1) {
		// server needs to track socket connect() and end() events for all outbound requests, and update local socket table
		let data = api.model.getProbes();
		data.forEach(async(probe) => {
			// foreach configured link
			let connId = api.model.getLink(probe); // creates a conn-id

			try {
				// only a single post/reply pair - send details and receive details
				// get local socket details - per link
				// populate body - if present
				let json = {};
			        console.log('prepare >>> ROUTE list for conn: ' + connId);
				if(typeof(api.connections[connId]) != 'undefined') {
					json = {
						nodeId,
						connId,
						socket: api.connections[connId].localConn,
						routes: api.model.prepareRouteList(connId)
					};
				}

				// fire request
				let conn = await got.post(probe.endpoint, {
					agent,
					headers: {
						'conn-id': connId
					},
					json,
					responseType: 'json'
				});

				// update local connection table
				let socket = conn.request.socket;
				let body = conn.body;
				createConnEntry(connId, {
					id: connId,
					socketId: '>' + socket.localAddress + ':' + socket.localPort + '-' + socket.remoteAddress + ':' + socket.remotePort,
					localConn: {
						localAddress	: socket.localAddress,
						localPort	: socket.localPort,
						remoteAddress	: socket.remoteAddress,
						remotePort	: socket.remotePort
					},
					remoteConn: {
						remoteAddress	: body.socket.localAddress,
						remotePort	: body.socket.localPort,
						localAddress	: body.socket.remoteAddress,
						localPort	: body.socket.remotePort
					}
				});

				// update route table
				api.model.installRoutes(body.routes, connId);

				// set status
				api.model.setStatus(probe.name, {
					connection: connId,
					status: 'healthy'
				});
			} catch (error) {
				console.log('[ PROBE ] ' + probe.name + ' | ' + probe.endpoint + ' [ FAILURE ]');
				api.model.setStatus(probe.name, {
					connection: '',
					status: 'broken'
				});
				deleteLink(probe.endpoint);
				return false;
			}
		});

		// delete all CONNECTIONS that dont have a SOCKET
		validateConnections();

		// delete all ROUTES that dont have a CONNECTION
		validateRoutes();

		await sleep(4000); // 4 seconds
	}
}

function createSocketEntry(key, socket) {
	let conn = {
		id		: key,
		protocol	: 'tcp',
		localAddress	: socket.localAddress,
		localPort	: socket.localPort,
		remoteAddress	: socket.remoteAddress,
		remotePort	: socket.remotePort,
		status		: 'ESTABLISHED'
	};
	api.sockets[key] = conn;
}

function deleteSocketEntry(key) {
	delete api.sockets[key];
}

function createConnEntry(key, spec) {
	api.model.updateConn(key, spec);
}

function deleteConnEntry(key) {
	api.model.deleteConn(key);
}

function deleteLink(key) {
	api.model.deleteLink(key);
}

function validateConnections() {
	api.model.getConnections().forEach((conn) => {
		if(!api.sockets[conn.socketId]) {
			api.model.deleteConn(conn.id);
			//conn.destroy();
		}
	});
}

function validateRoutes() {
	api.model.routes.get().forEach((route) => {
		if(route.connId != 'local' && !(api.connections[route.connId])) {
			api.model.routes.delete(route.node.id, route.connId);
		}
	});
}
