const axios = require('axios');

async function testUpload() {
  const supabaseUrl = 'https://sildxjncajthkoybgyno.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpbGR4am5jYWp0aGtveWJneW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MTU5MTksImV4cCI6MjA5NDQ5MTkxOX0.kxjsPtCYJ3hFodomkg2cxljxmu--UWazKK7pzOBLlDI';
  const filename = `test-${Date.now()}.png`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/attachments/logos/${filename}`;
  
  const dummyBuffer = Buffer.from('dummy-image-content-for-testing-direct-upload');

  console.log(`Testing direct upload to: ${uploadUrl}`);
  try {
    const res = await axios.post(uploadUrl, dummyBuffer, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'image/png',
      }
    });
    console.log('UPLOAD SUCCESSFUL!');
    console.log('Response:', res.data);
    
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/attachments/logos/${filename}`;
    console.log('Public URL:', publicUrl);
  } catch (err) {
    console.error('UPLOAD FAILED!');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

testUpload();
