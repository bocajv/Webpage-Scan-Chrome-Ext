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

                // Check for global objects
                if (window.jQuery) techs.push("jQuery");
                if (window.angular?.version?.full)
                  techs.push(`AngularJS v${window.angular.version.full}`);
                if ((window as any).React) techs.push("React");
                if ((window as any).Vue) techs.push("Vue.js");

                // Look for specific DOM attributes
                if (document.querySelector("[ng-app], [ng-controller]"))
                  techs.push("AngularJS");
                if (document.querySelector("[data-reactroot], [data-reactid]"))
                  techs.push("React");
                if (document.querySelector("[data-vue]")) techs.push("Vue.js");

                // Analyze script tags
                const frameworkCDNs = [
                  { keyword: "react", name: "React" },
                  { keyword: "vue", name: "Vue.js" },
                  { keyword: "angular", name: "AngularJS" },
                  { keyword: "jquery", name: "jQuery" },
                  { keyword: "bootstrap", name: "Bootstrap" },
                  { keyword: "modernizr", name: "Modernizr" },
                ];

                document.querySelectorAll("script[src]").forEach((script) => {
                  const src = script.getAttribute("src") || "";
                  frameworkCDNs.forEach(({ keyword, name }) => {
                    if (src.includes(keyword)) techs.push(name);
                  });
                });

                return techs;
              },
            },
            (results) => {
              const clientSideTechs = results[0]?.result || [];
              setTechnologies(clientSideTechs);
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
