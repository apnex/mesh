.? |
if (length > 0) then map({
	"id": .id,
	"protocol": .protocol,
	"localAddress": .localAddress,
	"localPort": .localPort,
	"remoteAddress": .remoteAddress,
	"remotePort": .remotePort,
	"status": .status
}) else empty end
