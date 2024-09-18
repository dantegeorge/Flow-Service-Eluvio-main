"use strict";
// Import dotenv
require("dotenv").config();
// Import the Eluvio CLient
const ElvModules = require("./modules/eluvio.consumer.modules");
// Import the moleculer db
const DbService = require("moleculer-db");
// Import the mongoose adapter for moleculer db
const MongooseAdapter = require("moleculer-db-adapter-mongoose");
// import the mongoose library for creating models and schemas
const mongoose = require("mongoose");
// Import the cron library
const Cron = require("moleculer-mixin-easy-cron");

/**
 * @typedef {import('moleculer').ServiceSchema} ServiceSchema Moleculer's Service Schema
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

/** @type {ServiceSchema} */
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

module.exports = {
	name: "service-eluvio",
	// The mixins to use for the service
	mixins: [DbService, Cron],
	// The adapter to use for the service
	adapter: new MongooseAdapter(process.env.MONGO_URL),
	// The name of the collection to use for the service
	collection: "catalogs",
	// The model for the users
	model: mongoose.model("Catalog", ContentSchema),
	settings: {
		cron: {
			interval: "0 0 * * * *",
		},
	},
	actions: {
		/**
		 * Command that runs the update process every day - cron job
		 * @param {Context} ctx - Moleculer's Context object
		 * @returns {Promise} - Promise resolving to the result of startMigration()
		 */
		tick: (ctx) => ctx.emit(startMigration()),
		/**
		 * Get Eluvio Content Objects + metadata from specified libraryID
		 * @returns {Promise} - Promise resolving to a JSON list of Content Objects
		 */
		migration: {
			rest: {
				method: "GET",
				path: "/migration",
			},
			async handler() {
				try {
					const content = await ElvModules.getContentObjects();
					const existingObjects = new Map();

					// Retrieve all existing objects from the database
					const existingObjectsArray = await this.adapter.find();

					// Build a map of existing objects for efficient lookup
					for (const existingObject of existingObjectsArray) {
						existingObjects.set(
							existingObject.elv_object_id,
							existingObject
						);
					}

					const migrationPromises = content.map(async (obj) => {
						const existingObject = existingObjects.get(
							obj.elv_object_id
						);

						if (existingObject) {
							// Compare the properties of existing and new objects dynamically
							let isUpdated = false;
							for (const field in obj) {
								if (
									existingObject[field] !== undefined &&
									existingObject[field] !== obj[field]
								) {
									existingObject[field] = obj[field];
									isUpdated = true;
								}
							}

							// Update the existing object if there are any changes
							if (isUpdated) {
								await existingObject.save();
							}
						} else {
							// Create a new object if it doesn't exist
							await this.adapter.insert(obj);
						}
					});

					await Promise.all(migrationPromises);

					return {
						success: true,
						message:
							"Content objects successfully migrated to OasysDB!",
					};
				} catch (error) {
					console.error("Error migrating content:", error);
					return {
						success: false,
						message: "Error migrating content",
						error: error.message,
					};
				}
			},
		},
	},
	methods: {
		/**
		 * Starts the migration process
		 * @returns {Promise} - Promise resolving to the result of the migration process
		 */
		async startMigration() {
			try {
				const content = await ElvModules.getContentObjects();
				const existingObjects = new Map();

				// Retrieve all existing objects from the database
				const existingObjectsArray = await this.adapter.find();

				// Build a map of existing objects for efficient lookup
				for (const existingObject of existingObjectsArray) {
					existingObjects.set(
						existingObject.elv_object_id,
						existingObject
					);
				}

				const migrationPromises = content.map(async (obj) => {
					const existingObject = existingObjects.get(
						obj.elv_object_id
					);

					if (existingObject) {
						// Compare the properties of existing and new objects dynamically
						let isUpdated = false;
						for (const field in obj) {
							if (
								existingObject[field] !== undefined &&
								existingObject[field] !== obj[field]
							) {
								existingObject[field] = obj[field];
								isUpdated = true;
							}
						}

						// Update the existing object if there are any changes
						if (isUpdated) {
							await existingObject.save();
						}
					} else {
						// Create a new object if it doesn't exist
						await this.adapter.insert(obj);
					}
				});

				await Promise.all(migrationPromises);

				return {
					success: true,
					message:
						"Content objects successfully migrated to OasysDB!",
				};
			} catch (error) {
				console.error("Error migrating content:", error);
				return {
					success: false,
					message: "Error migrating content",
					error: error.message,
				};
			}
		},
	},
	/**
	 * Service started lifecycle event handler
	 */
	async started() {
		console.log("Eluvio-service has started!");
	},
};
