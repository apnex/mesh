.items? |
if (length > 0) then map({
	"name": .name,
	"endpoint": .endpoint,
	"connection": .connection,
	"status": .status
}) else empty end
