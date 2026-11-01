export async function request(path, body) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok)
        throw new Error(data.error || 'Request failed. Try again.');
    return data;
}
export function connectState(onState, onConnection) {
    let source, disposed = false;
    const params = new URLSearchParams(location.search);
    const suffix = location.pathname === '/overlay' ? '?' + new URLSearchParams([...params].filter(([k]) => ['channel', 'practice'].includes(k))).toString() : '';
    fetch('/api/state' + suffix).then(r => { if (!r.ok)
        throw new Error(); return r.json(); }).then(onState).catch(() => onConnection(false));
    source = new EventSource('/api/events' + suffix);
    source.onmessage = event => { if (disposed)
        return; try {
        onState(JSON.parse(event.data));
        onConnection(true);
    }
    catch {
        onConnection(false);
    } };
    source.onerror = () => onConnection(false);
    return () => { disposed = true; source?.close(); };
}
