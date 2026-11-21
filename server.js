import http from "node:http";

const PORT = process.env.PORT || 3000;
const ETAS_URL =
  "https://segovia.avanzagrupo.com/detalleparada?p_p_id=adoParadaFecha_AdoParadaFechaPortlet_INSTANCE_HBkPbUN4h6ZI&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_cacheability=cacheLevelPage&_adoParadaFecha_AdoParadaFechaPortlet_INSTANCE_HBkPbUN4h6ZI_cmd=getETAS";
const STOP_FIELD =
  "_adoParadaFecha_AdoParadaFechaPortlet_INSTANCE_HBkPbUN4h6ZI_busStopID";

function extractBusesArray(resp) {
  let rawTraffic = null;
  if (resp && resp.jsontraffics2 !== undefined) rawTraffic = resp.jsontraffics2;
  else if (resp && resp.value !== undefined) rawTraffic = resp.value;
  else if (resp && resp.buses !== undefined) rawTraffic = resp.buses;
  else if (Array.isArray(resp)) rawTraffic = resp;

  let parsed = [];
  if (typeof rawTraffic === "string") {
    const trimmed = rawTraffic.trim();
    if (trimmed.length > 0) {
      const maybeParsed = JSON.parse(trimmed);
      parsed = Array.isArray(maybeParsed) ? maybeParsed : [maybeParsed];
    }
  } else if (Array.isArray(rawTraffic)) {
    parsed = rawTraffic;
  } else if (rawTraffic && typeof rawTraffic === "object") {
    parsed = [rawTraffic];
  }

  const buses = [];
  for (const item of parsed) {
    if (!item) continue;
    if (Array.isArray(item.value)) {
      for (const v of item.value) {
        if (v) buses.push(v);
      }
    } else {
      buses.push(item);
    }
  }
  return buses;
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/etas") {
    const stop = url.searchParams.get("stop") || "35";
    try {
      const formBody = new URLSearchParams();
      formBody.set(STOP_FIELD, stop);

      const avanzaRes = await fetch(ETAS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "es-ES,es;q=0.9",
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://segovia.avanzagrupo.com/detalleparada",
          Origin: "https://segovia.avanzagrupo.com",
        },
        body: formBody.toString(),
      });

      const text = await avanzaRes.text();
      let respJson = null;
      try {
        respJson = JSON.parse(text);
      } catch {
        res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(
          JSON.stringify({
            stop,
            source: "error",
            error: "Respuesta no JSON de Avanza",
            httpStatus: avanzaRes.status,
            preview: text.slice(0, 400),
            buses: [],
          })
        );
      }

      const buses = extractBusesArray(respJson);
      let stopName = "";
      if (respJson && respJson.stopName) {
        stopName = String(respJson.stopName);
      } else if (buses.length > 0 && buses[0].desArrivalBusStop) {
        stopName = String(buses[0].desArrivalBusStop);
      }

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(
        JSON.stringify({
          stop,
          stopName,
          source: "avanza",
          buses,
        })
      );
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(
        JSON.stringify({
          stop,
          source: "error",
          error: err && err.message ? err.message : "Error de red",
          buses: [],
        })
      );
    }
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Radar Segovia proxy activo. Usa /etas?stop=35");
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});