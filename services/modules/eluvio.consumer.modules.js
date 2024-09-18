"use strict";
require("dotenv").config();
// Import the Eluvio Client
const { ElvClient } = require("@eluvio/elv-client-js");

// Import necessary IDs
const ElvPrivKey = process.env.ELV_PRIVKEY;
const ElvLibId = process.env.ELV_LIBID;
const ElvUrl = process.env.ELV_URL;

module.exports = {
	/**
	 * Retrieves content objects with metadata from the specified library.
	 * Downloads images associated with the content objects.
	 * @returns {Promise} - Promise resolving to an array of content objects with metadata and image buffers.
	 */
	async getContentObjects() {
		try {
			// Initialize the Eluvio Client
			const client = await ElvClient.FromConfigurationUrl({
				configUrl: ElvUrl,
			});

			// Authenticate the client with a wallet and signer
			const wallet = client.GenerateWallet();
			const signer = wallet.AddAccount({
				privateKey: ElvPrivKey,
			});
			client.SetSigner({ signer });

			// Retrieve content objects from the library with selected metadata fields
			const res = await client.ContentObjects({
				libraryId: ElvLibId,
				filterOptions: {
					select: [
						"/public/name",
						"/public/asset_metadata/info",
						"/public/asset_metadata/display_title",
						"/public/asset_metadata/images",
					],
				},
				filter: {
					key: "/public/asset_metadata/images",
					type: "ctn",
				},
			});

			const contentObjects = [];
			const maxPayloadSize = 1024 * 1024; // 1MB
			const concurrencyLimit = Math.floor(maxPayloadSize / 1000000); // Adjust the divisor based on the average image size (1MB = 1000000 bytes)
			let runningDownloads = 0; // Counter for running downloads

			for (let index = 0; index < res.contents.length; index++) {
				const content = res.contents[index];
				const version = content.versions[0];

				// Check if versions.meta.public is defined
				if (!version.meta || !version.meta.public) {
					continue;
				}

				const metadata = version.meta.public;

				// Check if .versions.meta.public.asset_metadata.images is defined
				if (
					!metadata.asset_metadata ||
					!metadata.asset_metadata.images
				) {
					continue;
				}

				const { id: elv_object_id, hash: version_hash } = version;
				const {
					asset_metadata: {
						display_title,
						info: {
							copyright,
							creator,
							release_date,
							runtime,
							synopsis,
						},
					},
					name: object_name,
				} = metadata;

				const imagePath =
					metadata.asset_metadata.images.landscape.default["/"];
				const filePath = imagePath.split("/").pop();
				//Image changed due to NATS error
				const image = null;
				const imgDownloadPromise = client
					.DownloadFile({
						libraryId: ElvLibId,
						objectId: elv_object_id,
						filePath: filePath,
						format: "buffer",
					})
					.then(() => {
						//image should be constructed inside .then((image))
						const contentObject = {
							elv_object_id,
							object_name,
							display_title,
							version_hash,
							image,
							copyright,
							creator,
							release_date,
							runtime,
							synopsis,
						};

						contentObjects.push(contentObject);
					})
					.catch((error) => {
						console.log(
							"Error downloading image for index",
							index,
							error
						);
					})
					.finally(() => {
						runningDownloads--; // Decrement the running downloads counter when a download is complete
					});

				if (runningDownloads >= concurrencyLimit) {
					await imgDownloadPromise; // Wait for a download to complete before starting the next one
				} else {
					runningDownloads++;
				}
			}

			// Wait for all remaining downloads to complete
			await Promise.allSettled(
				Array.from({ length: runningDownloads }, () =>
					Promise.resolve()
				)
			);
			console.log(contentObjects);
			return contentObjects;
		} catch (error) {
			throw new Error("Error retrieving content objects: " + error);
		}
	},
};
