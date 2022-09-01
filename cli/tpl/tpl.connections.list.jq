.? |
if (length > 0) then map({
	"id": .id,
	"lLocalAddress": .localConn.localAddress,
	"lLocalPort": .localConn.localPort,
	"lRemoteAddress": .localConn.remoteAddress,
	"lRemotePort": .localConn.remotePort,
	"rLocalAddress": .remoteConn.localAddress,
	"rLocalPort": .remoteConn.localPort,
	"rRemoteAddress": .remoteConn.remoteAddress,
	"rRemotePort": .remoteConn.remotePort
}) else empty end
