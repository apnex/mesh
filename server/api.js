#!/usr/bin/env node
'use strict';
import express from 'express';
import path from 'path';
import os from 'os';

const api = express();
api.use(express.json());
//app.use(bodyParser.urlencoded({ extended: false }));

// set the data
var data = [];
var connections = {};
var nodes = {};
var routes = {};
var links = {};

// set the model
var model = {
	newId() {
		let dec = Math.round(Math.random() * 16777215); // 000000-FFFFFF
		let hex = Number(dec).toString(16).padStart(6, '0');
		return hex;
	},
	routes: {
		get: () => {
			return Object.values(routes);
		},
		update: (nodeId, connId, name) => {
			let key = nodeId + connId;
			if(typeof(routes[key.toString()]) == 'undefined') {
				routes[key.toString()] = {
					id: model.newId().toString(),
					connId,
					node: {
						id: nodeId,
						name
					}
				}
			}
		},
		delete: (nodeId, connId) => {
			let key = nodeId + connId;
			delete routes[key.toString()];
			return nodeId;
		}
	},
	prepareRouteList: (connId) => {
		return model.routes.get().filter((route) => {
			if(route.connId != connId) {
				return true;
			}
		}).map((route) => {
			return route.node;
		});
	},
	installRoutes: (routes, connId) => { // update route table
		// first, need to delete all routes for connId
		model.routes.get().filter((route) => {
			if(route.connId == connId) {
				return true;
			}
		}).forEach((route) => {
			model.routes.delete(route.node.id, connId);
		});;
		// next, install new ones for connId
		routes.forEach((node) => {
			if(node.id != model.nodeId) {
				model.routes.update(node.id, connId, node.name);
			}
		});
	},
	getProbes: () => {
		//console.log('[ getProbes ] /probes');
		return data;
	},
	setStatus: (probeName, body) => {
		//console.log('[ setStatus ] /probes/' + probeName);
		data.forEach((item) => {
			if(item.name == probeName) {
				item = Object.assign(item, body);
			}
		});
	},
	createProbe: (spec) => {
		//console.log('[ createProbe ] /probes/' + spec.name);
		data.forEach((item) => {
			if(item.name == spec.name) {
				console.log('NAME: ' + spec.name + ' exists!!');
			}
		});
		data.push(spec);
	},
	getLink: (probe) => {
		let id;
		if(typeof(links[probe.endpoint]) == 'undefined') {
			// chance of duplicate - need to handle reroll
			id = model.newId();
			links[probe.endpoint] = {
				id
			};
		} else {
			id = links[probe.endpoint].id;
		}
		return id;
	},
	deleteLink: (id) => {
		delete links[id];
		return id;
	},
	updateConn: (id, spec) => {
		connections[id.toString()] = spec;
		return spec;
	},
	deleteConn: (id) => {
		delete connections[id];
		return id;
	},
	getConnections: () => {
		return Object.values(api.connections);
	}
};
api['model'] = model;
api['connections'] = connections;
api['data'] = data;
api['nodes'] = nodes;
api['routes'] = routes;
api['links'] = links;
api['sockets'] = {};

// create a link
// used by cli to activate a link
api.post('/probes', (req, res) => {
	console.log('[ POST ] /join');
	console.log(JSON.stringify(req.body, null, "\t"));

	// create probe
	model.createProbe({
		name: req.body.name,
		endpoint: req.body.endpoint,
		status: "unknown"
	});

	res.status(200).send(data);
});

// connections
api.get('/connections', (req, res) => {
	console.log('[ GET ] /connections');
	let body = Object.values(api.connections);
	res.status(200).send(body);
});

// sockets
api.get('/sockets', (req, res) => {
	console.log('[ GET ] /sockets');
	let body = Object.values(api.sockets);
	res.status(200).send(body);
});

// routes
api.get('/routes', (req, res) => {
	console.log('[ GET ] /routes');
	let body = Object.values(api.routes);
	res.status(200).send(body);
});

// used by nodes to transfer data
api.post('/links', (req, res) => {
	console.log('[ POST ] /links');
	let body = req.body;
	let socket = req.socket;

	// receive connection details from peer
	// update local connection table
	// install routes
	// return local socket details and routes

	let connId = body.connId;
	let nodeId = body.nodeId;
	let localConn = {
		localAddress	: socket.localAddress,
		localPort	: socket.localPort,
		remoteAddress	: socket.remoteAddress,
		remotePort	: socket.remotePort
	};
	if(connId) {
		if(body.socket) {
			// if id exists, update connection state and return body
			// if not exist, create new link
			model.updateConn(connId, {
				id: connId,
				socketId: '<' + socket.localAddress + ':' + socket.localPort + '-' + socket.remoteAddress + ':' + socket.remotePort,
				localConn,
				remoteConn: {
					remoteAddress	: body.socket.localAddress,
					remotePort	: body.socket.localPort,
					localAddress	: body.socket.remoteAddress,
					localPort	: body.socket.remotePort
				}
			});

			// install routes
			model.installRoutes(body.routes, connId);
		}
	} else {
		console.log('INCOMING LINK - <connId> missing! ignoring...');
	}

	// prepare route list
	console.log('prepare <<< ROUTE list for conn: ' + connId);

	// response
	res.status(201).send({
		nodeId: model.nodeId,
		connId,
		socket: localConn,
		routes: model.prepareRouteList(connId)
	});
});

api.get('/probes', (req, res) => {
	console.log('[ GET ] /probes');
	// construct server info
	let server = {
		name: os.hostname(),
		address: req.headers.host
	};

	// pull state
	let items = model.getProbes();
	let body = {
		server,
		items
	};

	res.status(200).send(body);
});

api.get('/probes/:probeName', (req, res) => {
	let probeName = req.params.probeName;
	console.log('[ GET ] /probes/' + probeName);
	let probe = data.filter((item) => {
		return (item.name == probeName);
	})[0];
	res.status(200).send(probe);
});

api.put('/probes/:probeName', (req, res) => {
	let probeName = req.params.probeName;
	console.log('[ PUT ] /probes/' + probeName);
	data.forEach((item) => {
		if(item.name == probeName) {
			item = Object.assign(item, req.body);
		}
	});
	res.status(200).send({
		message: "Updated.. "
	});
});

api.delete('/probes/:probeName', (req, res) => {
	let probeName = req.params.probeName;
	console.log('[ DELETE ] /probes/' + probeName);
	data = data.filter((item) => {
		return (item.name != probeName);
	}); // remove
	res.status(200).send({
		message: "probe [ " + probeName + " ] deleted"
	});
});

api.get('/favicon.ico', (req, res) => {
	res.status(200).send({});
});

// Serve static html files
api.use('/', express.static(path.join(path.resolve(), '../html')))

//module.exports = app;
export default api;
