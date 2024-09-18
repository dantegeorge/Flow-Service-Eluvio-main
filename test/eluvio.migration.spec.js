"use strict";
require("dotenv").config();
const { ServiceBroker } = require("moleculer");
const EluvioService = require("../services/eluvio.service");
const ElvModules = require("../services/modules/eluvio.consumer.modules");
const DbService = require("moleculer-db");
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const mongoose = require("mongoose");
const broker = new ServiceBroker({
	logger: false,
});

const ContentSchema = new mongoose.Schema({
	elv_object_id: { type: String, required: true },
	object_name: { type: String, required: true },
	display_title: { type: String, required: true },
	version_hash: { type: String, required: true },
	image: { type: Buffer, required: false },
	copyright: { type: String, required: false },
	creator: { type: String, required: false },
	release_date: { type: String, required: false },
	runtime: { type: String, required: false },
	synopsis: { type: String, required: false },
});

beforeAll(async () => {
	const service = broker.createService({
		name: "eluvio-service-test",
		mixins: [DbService],
		adapter: new MongooseAdapter(process.env.MONGO_URL),
		collection: "testCatalog",
		actions: EluvioService.actions,
		model: mongoose.model("testCatalog", ContentSchema),
	});
	await broker.start();
});

afterAll(async () => {
	await broker.stop();
});

describe("eluvio-service-test", () => {
	describe("migrate_content endpoint", () => {
		// Increase the timeout value
		jest.setTimeout(100000);
		//succession test
		it("should migrate content successfully and return success message", async () => {
			const result = await broker.call("eluvio-service-test.migration");
			expect(result.success).toBe(true);
			expect(result.message).toBe(
				"Content objects successfully migrated to OasysDB!"
			);
		});
		//fail test
		it("should handle content migration failure and return error message", async () => {
			// Mock the ElvModules.migrateContent method to throw an error
			jest.spyOn(ElvModules, "getContentObjects").mockRejectedValueOnce(
				new Error("Error retrieving content objects: ")
			);

			const result = await broker.call("eluvio-service-test.migration");
			expect(result.success).toBe(false);
			expect(result.message).toBe("Error migrating content");
		});
	});
});
