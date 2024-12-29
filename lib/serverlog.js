export async function serverlog(message) {
  fetch('/api/serverlog', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ log: message }),
  })
    // .then(response => response.json())
    // .then(data => console.log(data));
}