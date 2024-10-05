import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { Agent } from "node:https";

export class RequestHandler {
  static #instance: RequestHandler;
  tunnelTimeout = 30000; // 30 seconds
  api_key;

  private constructor() {}

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
    return headers[0].split(": ")[1];
  }

  /**
   * Sends a proxied request to the specified URL.
   *
   * @param {string} url - The URL to send the request to.
   * @param {any} [headers={}] - The headers to include in the request.
   * @param {any} [params={}] - The query parameters to include in the request.
   * @returns {Promise<any>} A promise that resolves with the response data.
   * @throws {Error} If there is an error sending the request or if the proxy scheme is unsupported.
   */
  async proxiedRequest(
    url: string,
    headers: any = {},
    params: any = {},
    withoutApiKey = false
  ): Promise<any> {
    // Get the proxy URL from the environment variables.
    const proxyURL = process.env.PROXY_ENDPOINT;

    // Parse the proxy URL.
    const parsedUrl = new URL(proxyURL);

    // Create an agent based on the proxy protocol.
    let agent: Agent;
    if (parsedUrl.protocol.startsWith("http")) {
      // Use HttpsProxyAgent for HTTP proxies.
      agent = new HttpsProxyAgent(proxyURL);
    } else if (parsedUrl.protocol.startsWith("socks")) {
      // Use SocksProxyAgent for SOCKS proxies.
      agent = new SocksProxyAgent(proxyURL);
    } else {
      // Throw an error if the proxy scheme is unsupported.
      throw new Error(`Unsupported proxy scheme: ${parsedUrl.protocol}`);
    }

    let count = 0;
    let maxTries = 3;
    while (true) {
      try {
        if (!this.api_key && !withoutApiKey) {
          this.api_key = await this.getApiKey();
          headers["X-Cg-Apikey"] = this.api_key;
        } else if (!withoutApiKey) {
          headers["X-Cg-Apikey"] = this.api_key;
        }

        headers["host"] = process.env.HOST_URL; // Set the host URL in the request header.

        // Send the request using axios.
        const response = await axios.get(url, {
          httpAgent: agent, // Use the created agent for HTTP requests.
          httpsAgent: agent, // Use the created agent for HTTPS requests.
          timeout: this.tunnelTimeout, // Set the request timeout.
          headers, // Include the specified headers.
          params, // Include the specified query parameters.
        });
        // Return the response data.
        return response.data;
      } catch (error) {
        // Retry the request if the error is a timeout.
        if (++count == maxTries) {
          console.warn(`Error on count: (${count})`);
          throw new Error(
            `HTTP error: ${
              error.response ? error.response.status : error.message
            }`
          );
        }
        console.warn(`Retrying request... (${count})`);
      }
    }
  }
}
