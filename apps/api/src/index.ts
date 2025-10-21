import { env } from "@/config.js";
import { app } from "@/server.js";

const { PORT } = env;

app.listen(PORT, () => console.log(`Example app listening on port ${PORT}`));

// const onCloseSignal = () => {};

// process.on("SIGINT", onCloseSignal);
// process.on("SIGTERM", onCloseSignal);
