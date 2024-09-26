import 'dotenv/config'
import axios from 'axios';
import {HttpsProxyAgent} from 'https-proxy-agent';
import {SocksProxyAgent} from 'socks-proxy-agent';
import {Agent} from "node:https";

const tunnelTimeout = 10000; // 10 seconds

async function main() {
    try {
        let apiKey = await getApiKey();
        const responseBody = await proxiedRequest(process.env.PRODUCT_URL, {
            'X-Cg-Apikey': apiKey,
            'host': process.env.HOST_URL,
        });
        console.log(responseBody);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

async function getApiKey() {
    const {changeHomestore: {storeLocator: {api: {headers}}}} = await proxiedRequest(process.env.API_URL);
    return headers[0].split(": ")[1];
}

async function proxiedRequest(url: string, headers: any = {}, params: any = {}) {
    const proxyURL = process.env.PROXY_ENDPOINT;
    const parsedUrl = new URL(proxyURL);

    let agent: Agent;
    if (parsedUrl.protocol.startsWith('http')) {
        agent = new HttpsProxyAgent(proxyURL);
    } else if (parsedUrl.protocol.startsWith('socks')) {
        agent = new SocksProxyAgent(proxyURL);
    } else {
        throw new Error(`Unsupported proxy scheme: ${parsedUrl.protocol}`);
    }

    try {
        const response = await axios.get(url, {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: tunnelTimeout,
            headers,
            params
        });
        return response.data;
    } catch (error) {
        throw new Error(`HTTP error: ${error.response ? error.response.status : error.message}`);
    }
}

main().catch(console.error);