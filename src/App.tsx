import { useState } from "react";
import "./App.css";

declare global {
  interface Window {
    jQuery?: any;
    angular?: any;
    React?: any;
    Vue?: any;
  }
}

const REQUIRED_HEADERS = [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Strict-Transport-Security",
  "Referrer-Policy",
];

function App() {
  const [protocol, setProtocol] = useState("");
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [technologies, setTechnologies] = useState<string[]>([]);

  const fetchProtocolAndHeaders = async () => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]?.url) {
          const url = new URL(tabs[0].url);
          setProtocol(url.protocol.replace(":", "")); // Set the protocol

          // Fetch headers from the active tab's URL
          const response = await fetch(url.href, { method: "HEAD" });

          if (!response.ok) {
            setError(`Failed to fetch headers: ${response.statusText}`);
            return;
          }

          // Analyze HTTP headers for technologies
          const receivedHeaders = [...response.headers.entries()];
          const techHeaders: string[] = [];

          for (const [key, value] of receivedHeaders) {
            if (key.toLowerCase() === "server") {
              techHeaders.push(`Server: ${value}`);
            }
            if (key.toLowerCase() === "x-powered-by") {
              techHeaders.push(`X-Powered-By: ${value}`);
            }
            if (key.toLowerCase() === "x-generator") {
              techHeaders.push(`Generator: ${value}`);
            }
          }

          setMissingHeaders(
            REQUIRED_HEADERS.filter(
              (header) =>
                !receivedHeaders
                  .map(([k]) => k.toLowerCase())
                  .includes(header.toLowerCase())
            )
          );

          // Inject script to detect client-side frameworks
          chrome.scripting.executeScript(
            {
              target: { tabId: tabs[0].id || 0 },
              func: () => {
                const techs: string[] = [];
                if (window.jQuery) techs.push("jQuery");
                if (window.angular) techs.push("AngularJS");
                if ((window as any).React) techs.push("React");
                if ((window as any).Vue) techs.push("Vue.js");

                // Look for script sources
                (
                  document.querySelectorAll(
                    "script[src]"
                  ) as NodeListOf<HTMLScriptElement>
                ).forEach((script) => {
                  if (script.src.includes("bootstrap")) techs.push("Bootstrap");
                  if (script.src.includes("modernizr")) techs.push("Modernizr");
                });

                return techs;
              },
            },
            (results) => {
              const clientSideTechs = results[0]?.result || [];
              setTechnologies([...techHeaders, ...clientSideTechs]);
            }
          );
        } else {
          setError("Could not retrieve the active tab's URL.");
        }
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(`Error fetching headers: ${err.message}`);
      } else {
        setError(`Error fetching headers: ${String(err)}`);
      }
    }
  };

  return (
    <div className="App">
      <h1>DAWG SCAN</h1>
      <img src="/icon.png" alt="Logo" />
      <button onClick={fetchProtocolAndHeaders}>Start Scan!</button>
      <h3>Protocol Used:</h3>
      <p>
        <strong>{protocol}</strong>
      </p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <h3>Missing Security Headers:</h3>
      <ul>
        {missingHeaders.length === 0 && !error ? (
          <p>No missing security headers.</p>
        ) : (
          missingHeaders.map((header) => <li key={header}>{header}</li>)
        )}
      </ul>
      <h3>Detected Technologies:</h3>
      <ul>
        {technologies.length > 0 ? (
          technologies.map((tech) => <li key={tech}>{tech}</li>)
        ) : (
          <p>No technologies detected.</p>
        )}
      </ul>
    </div>
  );
}

export default App;
