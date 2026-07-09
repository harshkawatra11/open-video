#!/usr/bin/env node
/** Stdio entrypoint the Claude CLI spawns per `--mcp-config` (see @openvideo/cli-adapter's mcp config
 *  writer). Never invoked directly by a human. */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createOpenVideoMcpServer } from "../src/index.ts";

const server = createOpenVideoMcpServer();
await server.connect(new StdioServerTransport());
