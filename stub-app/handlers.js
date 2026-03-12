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
  console.log("Button 3 clicked -- implement me!");
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
