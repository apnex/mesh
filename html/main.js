import ky from './ky.min.js';

// Returns a Promise that resolves after "ms" Milliseconds
function sleep(ms) {
	return new Promise((response) => {
		setTimeout(response, ms)
	});
}

async function start() {
	var data = [];
	while(1) { // main loop
		// get status
		checkStatus().then((body) => {
			// render table
			data = body;
			renderTable(body, 1);
		}).catch((err) => {
			console.log(JSON.stringify(data, null, "\t"));
			renderTable(data, 0);
		});

		// sleep
		await sleep(2000);
	}
}

async function checkStatus() {
	return await ky.get('/probes').json();
}

function renderTable(data, healthy) {
	// clear all rows from table
	let table = document.getElementById("probes");
	table.innerHTML = "";

	// create header row
	let cell0 = table.insertRow(0).insertCell(0);
	cell0.innerText = data.server.name + ' - ' + data.server.address;

	// check app health
	let tableborder = document.getElementById("tableborder");
	if(healthy) {
		tableborder.className = 'border-healthy';
		cell0.className = 'header-healthy';
	} else {
		tableborder.className = 'border-broken';
		cell0.className = 'header-broken';
		data.items.forEach((item) => {
			item.status = 'unknown';
		});
	}

	// build tiles
	data.items.forEach((item) => {
		// create a tile
		let div = document.createElement("div"); // create new div
		switch(item.status) {
			case('healthy'):
				div.className = 'healthy';
				break;
			case('broken'):
				div.className = 'broken';
				break;
			default:
				div.className = 'unknown';
				break;
		}
		//div.appendChild(buildTile(item));
		div.appendChild(buildTable(item));

		// attach to new cell
		let cell = table.insertRow(-1).insertCell(0);
		cell.appendChild(div);
	});
	console.log('data: ', data);
}

function buildTile(probe) {
	let table = document.createElement("table");
	let cell0 = table.insertRow(0).insertCell(0);
	let cell1 = table.insertRow(1).insertCell(0);
	let cell2 = table.insertRow(2).insertCell(0);
	table.className = 'probe';
	cell0.innerText = probe.name;
	cell0.className = 'probe-name';
	cell1.innerText = probe.status;
	cell1.className = 'probe-status';
	cell2.innerText = probe.endpoint;
	cell2.className = 'probe-endpoint';
	return table;
}

function buildNewTile(probe) {
	let table = document.createElement("table");
	let row0 = table.insertRow(0);
	let cell1 = row0.insertCell(-1);
	let cell2 = row0.insertCell(-1);
	let cell3 = row0.insertCell(-1);
	table.className = 'probe';
	cell1.innerText = probe.name;
	cell1.className = 'probe-name';
	cell2.innerText = probe.status;
	cell2.className = 'probe-status';
	cell3.innerText = probe.endpoint;
	cell3.className = 'probe-endpoint';
	console.log(table.element);
	return table;
}

function buildTable(session) {
	let tableSpec = [
		[
			{
				text	: 'connection:a6fe',
				style	: 'probe',
				colSpan	: '2'
			},
			{
				text	: '',
				style	: 'probe',
				colSpan	: '1'
			},
			{
				text	: 'connection:b61c',
				style	: 'probe',
				colSpan	: '2'
			}
		],
		[
			{
				text	: session.localConn.localAddress + ':' + session.localConn.localPort,
				style	: 'probe',
				colSpan	: '1'
			},
			{
				text	: session.localConn.remoteAddress + ':' + session.localConn.remotePort,
				style	: 'probe',
				colSpan	: '1'
			},
			{
				text	: session.status,
				style	: 'probe-status',
				colSpan	: '1'
			},
			{
				text	: session.remoteConn.remoteAddress + ':' + session.remoteConn.remotePort,
				style	: 'probe',
				colSpan	: '1'
			},
			{
				text	: session.remoteConn.localAddress + ':' + session.remoteConn.localPort,
				style	: 'probe',
				colSpan	: '1'
			}
		],
		[
			{
				text	: 'session:' + session.id,
				style	: 'probe',
				colSpan	: '5'
			}
		]
	];

	// build table
	let table = document.createElement("table");
	table.className = 'probe';
	tableSpec.forEach((y) => {
		let row = table.insertRow(-1);
		y.forEach((x) => {
			let cell = row.insertCell(-1);
			cell.innerText	= x.text;
			cell.className	= x.style;
			cell.colSpan	= x.colSpan;
		});
	});
	return table;
}

start();
