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
  const newTab = window.open("", "_blank");

  if (!newTab) {
    alert("Popup blocked. Please allow popups for this site.");
    return;
  }

  newTab.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Random Joke</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f8fafc;
          margin: 0;
          padding: 40px;
          color: #1e293b;
        }

        .card {
          max-width: 700px;
          margin: 40px auto;
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }

        h1 {
          margin-bottom: 15px;
        }

        p {
          line-height: 1.6;
        }

        .loading {
          color: #475569;
        }

        .error {
          color: #b91c1c;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Random Joke Page</h1>
        <p>This page shows a random joke fetched from a public API.</p>
        <p class="loading">Loading joke...</p>
      </div>
    </body>
    </html>
  `);

  newTab.document.close();

  fetch("https://official-joke-api.appspot.com/random_joke")
    .then(response => response.json())
    .then(data => {
      newTab.document.body.innerHTML = `
        <div class="card" style="
          max-width: 700px;
          margin: 40px auto;
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          font-family: Arial, sans-serif;
          color: #1e293b;
        ">
          <h1>Random Joke Page</h1>
          <p>This page shows a random joke fetched from a public API.</p>
          <p><strong>Setup:</strong> ${data.setup}</p>
          <p><strong>Punchline:</strong> ${data.punchline}</p>
          <p><em>Data source: Goksel's cmpe220 jokes</em></p>
        </div>
      `;
      newTab.document.body.style.background = "#f8fafc";
      newTab.document.body.style.margin = "0";
      newTab.document.body.style.padding = "40px";
    })
    .catch(error => {
      newTab.document.body.innerHTML = `
        <div class="card" style="
          max-width: 700px;
          margin: 40px auto;
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          font-family: Arial, sans-serif;
          color: #1e293b;
        ">
          <h1>Random Joke Page</h1>
          <p>This page shows a random joke fetched from a public API.</p>
          <p style="color: #b91c1c;"><strong>Error:</strong> Joke could not be loaded.</p>
          <p>${error}</p>
        </div>
      `;
      newTab.document.body.style.background = "#f8fafc";
      newTab.document.body.style.margin = "0";
      newTab.document.body.style.padding = "40px";
    });
}
