const axios = require('axios');

async function run() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc3MzFkMjgwLWQ0NDUtNGIzNi1iNzEwLWY2ZTNlM2Y3YzFiYiIsImVtYWlsIjoic2hhbTgwNTYwNzE5NDlAZ21haWwuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzc5MTc1MDI3LCJleHAiOjE3Nzk3Nzk4Mjd9.uYMIVEjRzdVNhIUZOUneYc7WbBx04Hqwxaxau6Rfa80';
  
  // Create simulated FormData
  const formData = new FormData();
  formData.append('materialName', 'Cvt');
  formData.append('vendorName', '');
  formData.append('quantity', '1');
  formData.append('unit', 'units');
  formData.append('estimatedRate', '100');
  formData.append('actualRate', '');
  formData.append('status', 'PLANNING');
  formData.append('notes', '');
  formData.append('phaseId', '');
  formData.append('cgst', '');
  formData.append('sgst', '');
  formData.append('igst', '');
  formData.append('discount', '');

  try {
    const res = await axios.put(
      'http://localhost:5000/api/projects/4d605221-fb53-4bad-ac0d-951435561387/procurement/items/c3bc726b-3198-4e73-8c81-dece1e8b84f3',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    console.log('Success! Response status:', res.status);
    console.log('Response data:', res.data);
  } catch (err) {
    console.error('Error status:', err.response?.status);
    console.error('Error message:', err.response?.data);
  }
}

run();
