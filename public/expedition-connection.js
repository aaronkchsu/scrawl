export async function request(path, body) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok)
        throw new Error(data.error || 'Request failed. Try again.');
    return data;
}
export function connectState(onState, onConnection) {
    let disposed = false, connected;
    const report = value => { if (connected !== value) { connected = value; onConnection(value); } };
    const params = new URLSearchParams(location.search);
    const suffix = location.pathname === '/overlay' ? '?' + new URLSearchParams([...params].filter(([k]) => ['channel', 'practice'].includes(k))).toString() : '';
    // The event stream sends a full snapshot immediately, including on reconnect.
    // A separate fetch could arrive late and overwrite that newer snapshot.
    const source = new EventSource('/api/events' + suffix);
    source.onmessage = event => { if (disposed)
        return; try {
        const snapshot = JSON.parse(event.data);
        onState(snapshot);
        report(snapshot.healthy !== false);
    }
    catch {
        report(false);
    } };
    source.onerror = () => { if (!disposed) report(false); };
    return () => { disposed = true; source?.close(); };
}
