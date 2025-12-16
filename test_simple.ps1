# Simple test script to verify UDP connection
param(
    [string]$Host = "127.0.0.1",
    [int]$Port = 514
)

Write-Host "Testing UDP connection to $Host`:$Port" -ForegroundColor Cyan

try {
    $udpClient = New-Object System.Net.Sockets.UdpClient
    $endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse($Host), $Port)
    
    $testMessage = "<165>1 2024-01-01T12:00:00.000Z test-host test-app 12345 test-msgid Test message"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($testMessage)
    
    Write-Host "Sending: $testMessage" -ForegroundColor Yellow
    $bytesSent = $udpClient.Send($bytes, $bytes.Length, $endpoint)
    Write-Host "Sent $bytesSent bytes" -ForegroundColor Green
    
    $udpClient.Close()
    Write-Host "Message sent successfully!" -ForegroundColor Green
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Note: On Windows, port 514 may require administrator privileges" -ForegroundColor Yellow
}

