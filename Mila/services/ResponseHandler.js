class ResponseHandler {
    /*
        successResponse(res) will return:
        {
            success: true,
            message: "operation succeed",
            data_type: null,
            data: null 
        }

        successResponse(res, message) will return:
        {
            success: true,
            message; message,
            data_type: null,
            data: null
        }

        successResponse(res, message, data) will return:
        {
            success: true,
            message: message,
            data_type: "json" or "array" depending to data,
            data: data
        }

        successResponse(res, message, data, status_code) will return same as
        successResponse(res, message, data) but with status code = status_code
    */
    successResponse(res, message = "operation succeed", data = null, status_code = 200) {
        let data_type = null;
        if (typeof data === 'object' && data !== null) {
            data_type = "json";
        }
        if (Array.isArray(data)) {
            data_type = "array";
        }
        let response = {
            success: true,
            message: message,
            data_type: data_type,
            data: data
        };
        res.status(status_code).send(response);
    }

    errorResponse(res, message, errors, status_code) {
        let response = {
            success: false,
            message: message,
            errors: errors,
            status: status_code
        };
        res.status(status_code).send(response);
    }
}

const responseHandler = new ResponseHandler()

module.exports = responseHandler;