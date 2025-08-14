import axios, { AxiosError } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { Agent } from "node:https";
import { delay } from "./delay";

export class RequestHandler {
  static #instance: RequestHandler;
  tunnelTimeout = 30000; // 30 seconds
  api_key;
  agents: Agent[] = [];
  maxTries = 10;

  private constructor() {
    if (process.env.ENABLE_PROXY) {
      // Get the proxy URL from the environment variables.
      const proxyURLs = process.env.PROXY_ENDPOINT.split(",");

      for (let index in proxyURLs) {
        const proxyURL = proxyURLs[index];
        // Parse the proxy URL.
        const parsedUrl: URL = new URL(proxyURL);

        // Create an agent based on the proxy protocol.
        if (parsedUrl.protocol.startsWith("http")) {
          // Use HttpsProxyAgent for HTTP proxies.
          this.agents.push(new HttpsProxyAgent(proxyURL));
        } else if (parsedUrl.protocol.startsWith("socks")) {
          // Use SocksProxyAgent for SOCKS proxies.
          this.agents.push(new SocksProxyAgent(proxyURL));
        } else {
          // Throw an error if the proxy scheme is unsupported.
          throw new Error(`Unsupported proxy scheme: ${parsedUrl.protocol}`);
        }
      }
    }
  }

  public static get instance(): RequestHandler {
    if (!RequestHandler.#instance) {
      RequestHandler.#instance = new RequestHandler();
    }

    return RequestHandler.#instance;
  }

  /**
   * Retrieves the API key.
   *
   * @returns {Promise<string>} A promise that resolves with the API key.
   */
  async getApiKey(): Promise<string> {
    if (!this.api_key) {
      // Make a request to the API URL and extract the headers.
      const {
        changeHomestore: {
          storeLocator: {
            api: { headers },
          },
        },
      } = await this.proxiedRequest(process.env.API_URL, {}, {}, true);

      // Extract the API key from the headers.
      // Assumes the API key is in the first header and formatted as "key: value".
      this.api_key = headers[0].split(": ")[1];
    }
    return this.api_key;
  }

  /**
   * Sends a proxied request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {any} [headers={}] - The headers to include in the request.
   * @param {any} [params={}] - The query parameters to include in the request.
   * @param withoutApiKey
   * @returns {Promise<any>} A promise that resolves with the response data.
   * @throws {Error} If there is an error sending the request or if the proxy scheme is unsupported.
   */
  async proxiedRequest(
    url: string,
    headers: any = {},
    params: any = {},
    withoutApiKey = false
  ): Promise<any> {
    if (!withoutApiKey) {
      headers["X-Cg-Apikey"] = await this.getApiKey();
    }

    headers["host"] =
      url === process.env.API_URL
        ? process.env.HOST_URL
        : process.env.API_HOST_URL; // Set the host URL in the request header.

    let options: any = {
      timeout: this.tunnelTimeout, // Set the request timeout.
      headers, // Include the specified headers.
      params, // Include the specified query parameters.
    };
    if (process.env.ENABLE_PROXY) {
      let agent = this.agents[Math.floor(Math.random() * this.agents.length)];
      console.log("using proxy: " + agent.getName);

      options = {
        httpAgent: agent, // Use the created agent for HTTP requests.
        //httpsAgent: agent, // Use the created agent for HTTPS requests.
        ...options,
      };
    }

    let count = 0;
    while (true) {
      try {
        // Send the request using axios.
        const response = await axios.get(url, options);
        // Return the response data.
        return response.data;
      } catch (error) {
        // Retry the request if the error is a timeout.
        if (++count == this.maxTries) {
          console.warn(`Error on count: (${count})`);
          throw error;
        }
        if (error?.status === 408) await delay(5000);
        console.warn(`Retrying request... (${count})`);
      }
    }
  }
}
