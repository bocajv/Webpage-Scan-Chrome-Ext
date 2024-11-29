import { useState, useEffect } from "react";
import "./App.css";
import DropdownButton from "react-bootstrap/DropdownButton";
import "bootstrap/dist/css/bootstrap.min.css";
import Dropdown from "react-bootstrap/Dropdown";

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

interface Cookie {
  name: string;
  value: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
}

interface ServerInfo {
  key: string;
  value: string;
}

function App() {
  const [protocol, setProtocol] = useState("");
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [libraries, setLibraries] = useState<string[]>([]);
  const [cookies, setCookies] = useState<Cookie[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo[]>([]);
  const [isScanStarted, setIsScanStarted] = useState(false);

  const [scanProtocol, setScanProtocol] = useState(true);
  const [scanHeaders, setScanHeaders] = useState(true);
  const [scanCookies, setScanCookies] = useState(true);
  const [scanTechnologies, setScanTechnologies] = useState(true);
  const [scanLibraries, setScanLibraries] = useState(true);
  const [scanServer, setScanServer] = useState(true);

  useEffect(() => {
    chrome.storage.local.get(
      [
        "scanProtocol",
        "scanHeaders",
        "scanCookies",
        "scanTechnologies",
        "scanLibraries",
        "scanServer",
      ],
      (result) => {
        setScanProtocol(result.scanProtocol ?? true);
        setScanHeaders(result.scanHeaders ?? true);
        setScanCookies(result.scanCookies ?? true);
        setScanTechnologies(result.scanTechnologies ?? true);
        setScanLibraries(result.scanLibraries ?? true);
        setScanServer(result.scanServer ?? true);
      }
    );
  }, []);

  // Toggle scan options and save preferences
  const toggleScanOption = (option: string) => {
    switch (option) {
      case "protocol":
        setScanProtocol((prev) => {
          const newValue = !prev;
          chrome.storage.local.set({ scanProtocol: newValue });
          return newValue;
        });
        break;
      case "headers":
        setScanHeaders((prev) => {
          const newValue = !prev;
          chrome.storage.local.set({ scanHeaders: newValue });
          return newValue;
        });
        break;
      case "cookies":
        setScanCookies((prev) => {
          const newValue = !prev;
          chrome.storage.local.set({ scanCookies: newValue });
          return newValue;
        });
        break;
      case "technologies":
        setScanTechnologies((prev) => {
          const newValue = !prev;
          chrome.storage.local.set({ scanTechnologies: newValue });
          return newValue;
        });
        break;
      case "libraries":
        setScanLibraries((prev) => {
          const newValue = !prev;
          chrome.storage.local.set({ scanLibraries: newValue });
          return newValue;
        });
        break;
      case "server":
        setScanServer((prev) => {
          const newValue = !prev;
          chrome.storage.local.set({ scanServer: newValue });
          return newValue;
        });
        break;
      default:
        break;
    }
  };

  const fetchProtocolAndHeaders = async () => {
    setIsScanStarted(true);
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]?.url) {
          const url = new URL(tabs[0].url);
          setProtocol(url.protocol.replace(":", ""));

          // Fetch headers from the active tab's URL
          const response = await fetch(url.href, { method: "HEAD" });

          if (!response.ok) {
            setError(`Failed to fetch headers: ${response.statusText}`);
            return;
          }

          // Analyze HTTP headers for technologies
          const receivedHeaders = [...response.headers.entries()];
          const techHeaders: ServerInfo[] = [];

          receivedHeaders.forEach(([key, value]) => {
            if (key.toLowerCase() === "server")
              techHeaders.push({ key: "Server", value });
            if (key.toLowerCase() === "x-powered-by")
              techHeaders.push({ key: "X-Powered-By", value });
            if (key.toLowerCase() === "x-generator")
              techHeaders.push({ key: "Generator", value });
          });

          setServerInfo(techHeaders);

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
                if (window.jQuery)
                  techs.push(`jQuery: v${window.jQuery.fn.jquery}`);
                if (window.angular?.version?.full)
                  techs.push(`AngularJS v${window.angular.version.full}`);
                if ((window as any).React) techs.push("React");
                if ((window as any).Vue)
                  techs.push(`Vue.js: v${window.Vue.version}`);
                if ((window as any).Ember) techs.push("Ember.js");
                if ((window as any).Backbone) techs.push("Backbone.js");

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
                  { keyword: "ember", name: "Ember.js" },
                  { keyword: "backbone", name: "Backbone.js" },
                  { keyword: "svelte", name: "Svelte" },
                  { keyword: "tailwind", name: "Tailwind CSS" },
                  { keyword: "lodash", name: "Lodash" },
                ];

                const metaGenerator = document.querySelector(
                  "meta[name='generator']"
                );
                if (metaGenerator) {
                  techs.push(
                    `Generator: ${metaGenerator.getAttribute("content")}`
                  );
                }

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

          chrome.scripting.executeScript(
            {
              target: { tabId: tabs[0].id || 0 },
              func: () => {
                const detectedLibraries: string[] = [];

                // Check for common global objects
                if (window.jQuery)
                  detectedLibraries.push(`jQuery: v${window.jQuery.fn.jquery}`);
                if ((window as any).React) detectedLibraries.push("React");
                if (window.Vue)
                  detectedLibraries.push(`Vue.js: v${window.Vue.version}`);
                if ((window as any).angular?.version?.full)
                  detectedLibraries.push(
                    `AngularJS: v${window.angular.version.full}`
                  );
                if ((window as any).Backbone)
                  detectedLibraries.push("Backbone.js");
                if ((window as any).Ember) detectedLibraries.push("Ember.js");
                if ((window as any).Svelte) detectedLibraries.push("Svelte");

                // Check for HTML attributes specific to frameworks
                if (document.querySelector("[ng-app], [ng-controller]"))
                  detectedLibraries.push("AngularJS");
                if (document.querySelector("[data-reactroot], [data-reactid]"))
                  detectedLibraries.push("React");
                if (document.querySelector("[data-vue]"))
                  detectedLibraries.push("Vue.js");

                // Analyze script tags for libraries
                const libraryPatterns = [
                  { keyword: "jquery", name: "jQuery" },
                  { keyword: "lodash", name: "Lodash" },
                  { keyword: "moment", name: "Moment.js" },
                  { keyword: "axios", name: "Axios" },
                  { keyword: "d3", name: "D3.js" },
                  { keyword: "three", name: "Three.js" },
                  { keyword: "chart", name: "Chart.js" },
                  { keyword: "bootstrap", name: "Bootstrap" },
                  { keyword: "tailwind", name: "Tailwind CSS" },
                  { keyword: "modernizr", name: "Modernizr" },
                  { keyword: "popper", name: "Popper.js" },
                ];

                document.querySelectorAll("script[src]").forEach((script) => {
                  const src = script.getAttribute("src") || "";
                  libraryPatterns.forEach(({ keyword, name }) => {
                    if (src.toLowerCase().includes(keyword))
                      detectedLibraries.push(name);
                  });
                });

                return [...new Set(detectedLibraries)];
              },
            },
            (results) => {
              const libraries = results[0]?.result || [];
              setLibraries(libraries);
            }
          );

          chrome.cookies.getAll({ domain: url.hostname }, (cookies) => {
            setCookies(
              cookies.map((cookie) => ({
                name: cookie.name,
                value: cookie.value,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                sameSite: cookie.sameSite,
              }))
            );
          });
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
    <body className="ext-body">
      <div className="App">
        <h1 className="dawg">DAWG SCAN</h1>
        <img className="img" src="/icon.png" alt="Logo" />
        <button className="scan-btn" onClick={fetchProtocolAndHeaders}>
          Start Scan!
        </button>
        {/* DropdownButton with title and children */}
        <DropdownButton title="Select Scan Options" id="dropdown-basic-button">
          <Dropdown.Item onClick={() => toggleScanOption("protocol")}>
            Protocol {scanProtocol ? "✅" : ""}
          </Dropdown.Item>
          <Dropdown.Item onClick={() => toggleScanOption("headers")}>
            Headers {scanHeaders ? "✅" : ""}
          </Dropdown.Item>
          <Dropdown.Item onClick={() => toggleScanOption("technologies")}>
            Technologies {scanTechnologies ? "✅" : ""}
          </Dropdown.Item>
          <Dropdown.Item onClick={() => toggleScanOption("libraries")}>
            Libraries {scanLibraries ? "✅" : ""}
          </Dropdown.Item>
          <Dropdown.Item onClick={() => toggleScanOption("server")}>
            Server {scanServer ? "✅" : ""}
          </Dropdown.Item>
          <Dropdown.Item onClick={() => toggleScanOption("cookies")}>
            Cookies {scanCookies ? "✅" : ""}
          </Dropdown.Item>
        </DropdownButton>
        {isScanStarted && ( // Only display details if the scan has started
          <>
            {scanProtocol && (
              <>
                <h3>Protocol Used:</h3>
                <p>
                  <strong>{protocol}</strong>
                </p>
                {error && <p style={{ color: "red" }}>{error}</p>}
              </>
            )}
            {scanHeaders && (
              <>
                <h3 className="h3-head">Missing Security Headers:</h3>
                <ul>
                  {missingHeaders.length === 0 && !error ? (
                    <p>No missing security headers.</p>
                  ) : (
                    missingHeaders.map((header) => (
                      <li key={header}>{header}</li>
                    ))
                  )}
                </ul>
              </>
            )}
            {scanTechnologies && (
              <>
                <h3 className="h3-head">Detected Technologies:</h3>
                <ul>
                  {technologies.length > 0 ? (
                    technologies.map((tech) => <li key={tech}>{tech}</li>)
                  ) : (
                    <p>No technologies detected.</p>
                  )}
                </ul>
              </>
            )}
            {scanLibraries && (
              <>
                <h3 className="h3-head">Detected Java Script Libraries:</h3>
                <ul>
                  {libraries.length > 0 ? (
                    libraries.map((tech) => <li key={tech}>{tech}</li>)
                  ) : (
                    <p>No libraries detected.</p>
                  )}
                </ul>
              </>
            )}
            {scanServer && (
              <>
                <h3 className="h3-head">Detected Server Info:</h3>
                <ul>
                  {serverInfo.length > 0 ? (
                    serverInfo.map((info, index) => (
                      <li key={index}>
                        <strong>{info.key}:</strong> {info.value}
                      </li>
                    ))
                  ) : (
                    <p>No server info detected.</p>
                  )}
                </ul>
              </>
            )}
            {scanCookies && (
              <>
                <h3 className="h3-head">Detected Cookie Info:</h3>
                <ul>
                  {cookies.length > 0 ? (
                    cookies.map((cookie, index) => (
                      <li key={index}>
                        {cookie.name}: Secure={String(cookie.secure)}, HttpOnly=
                        {String(cookie.httpOnly)}, SameSite={cookie.sameSite}
                      </li>
                    ))
                  ) : (
                    <p>No cookies found on page.</p>
                  )}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </body>
  );
}

export default App;
