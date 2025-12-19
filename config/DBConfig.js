import { configDotenv } from 'dotenv';
import dayjs from 'dayjs';
import knex from 'knex';

configDotenv()

const commonConfig = ({ db }) => {

    if (db === undefined && typeof db === "string")
        throw new Error("Invalid Database Passed");
    return {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: db,
        password: process.env.DB_PWD,
        multipleStatements: true,
        typeCast: function (field, next) {
            if (field.type == "DATE") {
                let date = dayjs(field.string()).format("YYYY-MM-DD");
                if (date === "Invalid date") date = "0000-00-00";
                return date;
            } else if (field.type == "DATETIME") {
                let datetime = dayjs(field.string()).format("YYYY-MM-DD HH:mm:ss");
                if (datetime === "Invalid date") datetime = "0000-00-00 00-00-00";
                return datetime;
            }
            return next();
        },
    };
};



export const nyayadb = knex({
    client: "mysql2",
    pool: { min: 0, max: 10 },
    connection: commonConfig({ db: process.env.NYAYA_DB_NAME }),
});


export const masterDb = knex({
    client: 'mysql2',
    pool: { min: 1, max: 10 },
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: 'masterData',
        password: process.env.DB_PWD,
    }
})