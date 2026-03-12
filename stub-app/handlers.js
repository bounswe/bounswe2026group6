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
    const apiUrl = "https://api.adviceslip.com/advice";

  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {

      const advice = data.slip.advice;

      alert(
        "Random Advice:\n\n" +
        advice +
        "\n\nData from AdviceSlip API"
      );

    })
    .catch(error => {
      alert("API alınamadı: " + error);
    });

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
  const newTab = window.open("", "_blank");

  if (!newTab) {
    alert("Popup engellendi. Lütfen popuplara izin ver.");
    return;
  }

  newTab.document.write("<pre>Loading API data...</pre>");

  fetch("https://jsonplaceholder.typicode.com/posts/1")
    .then((response) => {
      if (!response.ok) {
        throw new Error("HTTP error: " + response.status);
      }
      return response.json();
    })
    .then((data) => {
      newTab.document.body.innerHTML = `
        <pre>
Button 4 API Result

Explanation:
- userId: Postu oluşturan kullanıcının id'si
- id: Postun kendi id'si
- title: Post başlığı
- body: Post içeriği

API Response:
${JSON.stringify(data, null, 2)}
        </pre>
      `;
    })
    .catch((error) => {
      newTab.document.body.innerHTML = `
        <pre>API call failed: ${error.message}</pre>
      `;
    });
}

function onButton5Click() {
  console.log("Button 5 clicked -- implement me!");
}

function onButton6Click() {
  // Opens a new blank tab [cite: 49]
  const advicePage = window.open('', '_blank');
  
  // Injects the minimal HTML structure and API logic
  advicePage.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Daily Advice</title>
      <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f1f5f9; margin: 0; }
        .container { background: white; padding: 2.5rem; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); text-align: center; max-width: 450px; }
        h1 { color: #4f46e5; margin-bottom: 1.5rem; }
        #advice-text { font-size: 1.4rem; font-style: italic; color: #1e293b; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Random Advice</h1>
        <div id="advice-text">Loading...</div>
      </div>
      <script>
        fetch('https://api.adviceslip.com/advice')
          .then(response => response.json())
          .then(data => {
            document.getElementById('advice-text').innerText = '"' + data.slip.advice + '"';
          })
          .catch(error => {
            document.getElementById('advice-text').innerText = "Something went wrong.";
          });
      <\/script>
    </body>
    </html>
  `);
  advicePage.document.close();
}


function onButton7Click() {
  console.log("Button 7 clicked -- implement me!");
}

