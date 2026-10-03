using System.Net.Http.Json;

var url = Environment.GetEnvironmentVariable("HEALTHCHECK_URL") ?? "http://localhost:9090/health";

using var client = new HttpClient();
client.Timeout = TimeSpan.FromSeconds(5);

try
{
    var response = await client.GetAsync(url);
    if (response.IsSuccessStatusCode)
    {
        Console.WriteLine($"[HealthCheck OK] KudibaInvoicing is healthy: {(int)response.StatusCode}");
        return 0;
    }

    Console.Error.WriteLine($"[HealthCheck FAIL] KudibaInvoicing returned status: {(int)response.StatusCode}");
    return 1;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"[HealthCheck ERROR] Failed to connect to {url}: {ex.Message}");
    return 1;
}
