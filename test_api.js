async function testBackend() {
  const url = 'https://ventanas-lime.vercel.app/api/catalogos/test-slug';
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('GET Response:', text.substring(0, 200));
  } catch (err) {
    console.error('Error:', err);
  }
}
testBackend();
