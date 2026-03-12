var jokeCategory = document.getElementById("joke-category");
var jokeSetup = document.getElementById("joke-setup");
var jokeDelivery = document.getElementById("joke-delivery");
var refreshButton = document.getElementById("refresh-joke");

function setLoadingState() {
  jokeCategory.textContent = "Loading";
  jokeSetup.textContent = "Fetching a joke...";
  jokeSetup.className = "joke-line status";
  jokeDelivery.textContent = "";
}

function renderJoke(data) {
  jokeCategory.textContent = data.category;
  jokeSetup.className = "joke-line";

  if (data.type === "single") {
    jokeSetup.textContent = data.joke;
    jokeDelivery.textContent = "";
    return;
  }

  jokeSetup.textContent = data.setup;
  jokeDelivery.textContent = data.delivery;
}

function renderError() {
  jokeCategory.textContent = "Unavailable";
  jokeSetup.textContent = "Could not load a joke right now.";
  jokeSetup.className = "joke-line status";
  jokeDelivery.textContent = "Try again in a moment.";
}

async function loadJoke() {
  setLoadingState();

  try {
    var response = await fetch("https://v2.jokeapi.dev/joke/Any?safe-mode");

    if (!response.ok) {
      throw new Error("Request failed");
    }

    var data = await response.json();

    if (data.error) {
      throw new Error("API returned an error");
    }

    renderJoke(data);
  } catch (error) {
    console.error(error);
    renderError();
  }
}

refreshButton.addEventListener("click", loadJoke);
loadJoke();
