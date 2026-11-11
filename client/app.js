const BACKEND_URL = 'http://localhost:5000';

const subscriptionData = [
  { id: 1, name: "Streaming Service A", category: "Entertainment", cost: 14.99, frequency: "Monthly", usage: "Low" },
  { id: 2, name: "Cloud Storage", category: "Utility", cost: 9.99, frequency: "Monthly", usage: "High" },
  { id: 3, name: "Gym Membership", category: "Health", cost: 45.00, frequency: "Monthly", usage: "Medium" },
  { id: 4, name: "Design Tool Pro", category: "Software", cost: 29.00, frequency: "Monthly", usage: "Low" }
];

const gridOptions = {
  columnDefs: [
    { field: "name", headerName: "Service" },
    { field: "category", headerName: "Category" },
    { field: "cost", headerName: "Cost ($)", valueFormatter: p => '$' + p.value.toFixed(2) },
    { field: "frequency", headerName: "Billing Cycle" },
    { field: "usage", headerName: "AI Usage Index" }
  ],
  rowData: subscriptionData,
  defaultColDef: { flex: 1, sortable: true, filter: true }
};

let gridApi = null;

document.addEventListener('DOMContentLoaded', () => {
  const gridDiv = document.querySelector('#gridContainer');
  
  if (window.agGrid && gridDiv) {
    // Clear out any previous grid instance to prevent Error #239
    gridDiv.innerHTML = ''; 
    gridApi = agGrid.createGrid(gridDiv, gridOptions);
  }
});

async function runAiAudit() {
  const outputCard = document.getElementById('aiOutput');
  const insightsDiv = document.getElementById('aiInsights');
  
  outputCard.style.display = 'block';
  insightsDiv.innerText = 'AI is evaluating your recurring patterns...';

  try {
    const res = await fetch(`${BACKEND_URL}/api/ai/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptions: subscriptionData })
    });
    const data = await res.json();
    
    let html = `<strong>Potential Monthly Savings: $${data.potentialSavings}</strong><ul>`;
    data.insights.forEach(item => { html += `<li>${item}</li>`; });
    html += '</ul>';
    
    insightsDiv.innerHTML = html;
  } catch (e) {
    insightsDiv.innerText = 'Error loading AI insights. Make sure backend server is running.';
  }
}

paypal.Buttons({
  style: {
    layout: 'vertical',
    color:  'gold',
    shape:  'rect',
    label:  'paypal'
  },
createOrder: (data, actions) => {
  return actions.order.create({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: '9.99'
      }
    }]
  });
},
  onApprove: async (data, actions) => {
    try {
      const details = await actions.order.capture();
      alert(`Payment Successful! Transaction ID: ${details.id}`);
      console.log('Capture result:', details);
    } catch (err) {
      console.error('Capture error:', err);
      alert('Payment capture failed. Check browser console.');
    }
  },
  onError: (err) => {
    console.error('PayPal SDK Error:', err);
  }
}).render('#paypal-button-container');
