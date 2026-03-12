/**
 * BUTTON CLICK HANDLERS
 *
 * Each button on the homepage has its own handler function below.
 * Replace the placeholder console.log with your own implementation.
 */

function onButton1Click() {
  console.log("Button 1 clicked -- implement me!");
}

function onButton2Click() {
  console.log("Button 2 clicked -- implement me!");
}

function onButton3Click() {
  // Mehmet Can Gürbüz - Button 3
  // Open-Meteo API
  const lat = 41.0082;
  const lon = 28.9784;
  const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

  const newWindow = window.open("", "_blank");
  newWindow.document.write("<html><head><title>İstanbul Hava Durumu</title></head><body><h2>Yükleniyor...</h2></body></html>");

  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      const weather = data.current_weather;
      newWindow.document.body.innerHTML = `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 40px auto; padding: 24px; background: #f1f5f9; border-radius: 12px; text-align: center;">
          <h2 style="color: #1e293b;">🌤️ İstanbul Hava Durumu</h2>
          <p><strong>Sıcaklık:</strong> ${weather.temperature}°C</p>
          <p><strong>Rüzgar Hızı:</strong> ${weather.windspeed} km/h</p>
          <p><strong>Rüzgar Yönü:</strong> ${weather.winddirection}°</p>
          <hr style="margin: 16px 0; border: none; border-top: 1px solid #cbd5e1;">
          <p style="font-size: 0.85rem; color: #64748b;"><em>Open-Meteo API'den alınmıştır</em></p>
          <p style="font-size: 0.8rem; color: #94a3b8;">Mehmet Can Gürbüz - Button 3</p>
        </div>
      `;
    })
    .catch(error => {
      newWindow.document.body.innerHTML = "<h2>Hata: " + error + "</h2>";
    });
}

function onButton4Click() {
  console.log("Button 4 clicked -- implement me!");
}

function onButton5Click() {
  console.log("Button 5 clicked -- implement me!");
}
