import { Request, Response } from "express";
import * as svc from "./svc/_";
import { logger } from "./util/_";

export async function getDescriberStats(req: Request, rsp: Response) {
  try {
    const stats = await svc.describer
      .getStats();
    rsp.json(stats);
  } catch (error) {
    _respondError(req, rsp, error);
  }
}

export async function describeAddressTransactions(req: Request, rsp: Response) {
  try {
    const { ip } = req;
    if (!ip) throw {
      status_code: 403,
      message: "Unidentifiable Requester",
    };

    const reqTime = new Date().getTime();

    const count = parseInt(`${req.query.count ?? 5}`);
    if (count < 1) throw {
      status_code: 400,
      message: "Minimum count is 1 transaction per request.",
    };
    if (count > 10) throw {
      status_code: 400,
      message: "Maximum count is 10 transactions per request.",
    };

    const descriptions = await svc.describer
      .describeAddressTransactions(
        req.params.address,
        count,
      );
    rsp.json(descriptions);

    const rspTime = new Date().getTime();

    _log(ip,                                                 // client identifier:
      { path: req.path, time: reqTime },                     // request path and time,
      { body: JSON.stringify(descriptions), time: rspTime }, // response body and time,
      { uuid: descriptions.id, time: rspTime - reqTime },    // process uuid and duration
    );
  } catch (error) {
    _respondError(req, rsp, error);
  }
};

export async function describeSpecificAddressTransaction(req: Request, rsp: Response) {
  try {
    const { ip } = req;
    if (!ip) throw {
      status_code: 403,
      message: "Unidentifiable Requester",
    };

    const reqTime = new Date().getTime();

    const description = await svc.describer
      .describeSpecificAddressTransaction(
        req.params.address,
        req.params.hash,
      );
    rsp.json(description);

    const rspTime = new Date().getTime();

    _log(ip,                                                // client identifier:
      { path: req.path, time: reqTime },                    // request path and time,
      { body: JSON.stringify(description), time: rspTime }, // response body and time,
      { uuid: description.id, time: rspTime - reqTime },    // process uuid and duration
    );
  } catch (error) {
    _respondError(req, rsp, error);
  }
};

function _log(client: string,
  request: { path: string, time: number; },
  response: { body: string, time: number; },
  process: { uuid: string, time: number; }) {
  logger.log.info({ client, request, response, process });
}

function _logError(
  client: string | undefined,
  path: string,
  time: number,
  error: any,
) {
  logger.log.error({ client, path, time, error });
}

function _respondError(request: Request, response: Response, error: any, status: number = 500) {
  const { ip, path } = request;
  const time = new Date().getTime();

  response
    .status(error.status_code ?? status)
    .json({ error: error.message ?? error });

  _logError(ip, path, time, error);
};
