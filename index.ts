import express from "express";
import { type Request, type Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import type { Apartment } from "./types/apartments.js";
import { type Filter } from "mongodb";

dotenv.config();

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI as string;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("dwell-spot");
    const apartmentCollection = db.collection<Apartment>("apartments");

    app.get("/api/apartments", async (req: Request, res: Response) => {
      const {
        search = "",
        location = "",
        price = "",
        sort = "newest",
        page = "1",
        limit = "8",
      } = req.query;

      const query: Filter<Apartment> = {};

      if (search) {
        query.title = {
          $regex: search as string,
          $options: "i",
        };
      }

      if (location) {
        query.location = {
          $regex: location as string,
          $options: "i",
        };
      }

      if (price) {
        const priceQuery: {
          $gte?: number;
          $lte?: number;
        } = {};

        switch (price) {
          case "0-1000":
            priceQuery.$lte = 1000;
            break;

          case "1000-2000":
            priceQuery.$gte = 1000;
            priceQuery.$lte = 2000;
            break;

          case "2000-3000":
            priceQuery.$gte = 2000;
            priceQuery.$lte = 3000;
            break;

          case "3000+":
            priceQuery.$gte = 3000;
            break;
        }

        query.price = priceQuery;
      }

      let sortOption = {};

      switch (sort) {
        case "price_asc":
          sortOption = { price: 1 };
          break;

        case "price_desc":
          sortOption = { price: -1 };
          break;

        case "rating":
          sortOption = { rating: -1 };
          break;

        default:
          sortOption = { createdAt: -1 };
      }

      const currentPage = Number(page);

      const perPage = Number(limit);

      const skip = (currentPage - 1) * perPage;

      const apartments = await apartmentCollection
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(perPage)
        .toArray();

      const total = await apartmentCollection.countDocuments(query);

      res.send({
        apartments,
        total,
        totalPages: Math.ceil(total / perPage),
        currentPage,
      });
    });

    app.get("/api/admin/apartments", async (req: Request, res: Response) => {
      try {
        const apartments = await apartmentCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.send({
          apartments,
          total: apartments.length,
        });
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch apartments",
        });
      }
    });

    app.get("/api/apartments/:id", async (req: Request, res: Response) => {
      const id = req.params.id;
      const apartment = await apartmentCollection.findOne({
        _id: new ObjectId(id as string),
      });

      if (!apartment) {
        res.status(404).json({ error: "Apartment not found" });
        return;
      }

      res.send(apartment);
    });

    app.get("/api/featured-apartments", async (req: Request, res: Response) => {
      const apartments = await apartmentCollection
        .find({ featured: true })
        .limit(4)
        .toArray();

      res.send(apartments);
    });

    app.get("/api/statistics", async (req: Request, res: Response) => {
      const apartments = await apartmentCollection.find().toArray();

      const totalApartments = apartments.length;

      const availableApartments = apartments.filter(
        (apartment) => apartment.status === "Available",
      ).length;

      const averagePrice =
        totalApartments > 0
          ? Math.round(
              apartments.reduce((sum, apartment) => sum + apartment.price, 0) /
                totalApartments,
            )
          : 0;

      const totalLocations = new Set(
        apartments.map((apartment) => apartment.location),
      ).size;

      res.send({
        totalApartments,
        availableApartments,
        averagePrice,
        totalLocations,
      });
    });

    app.post(
      "/api/apartments",
      async (req: Request<{}, {}, Apartment>, res: Response) => {
        try {
          const apartment: Apartment = {
            ...req.body,
            rating: 5,
            createdAt: new Date().toISOString(),
          };

          const result = await apartmentCollection.insertOne(apartment);

          res.status(201).send({
            success: true,
            message: "Apartment added successfully.",
            insertedId: result.insertedId,
          });
        } catch (error) {
          console.error(error);

          res.status(500).send({
            success: false,
            message: "Failed to add apartment.",
          });
        }
      },
    );

    app.delete("/api/apartments/:id", async (req: Request, res: Response) => {
      try {

        const id = req.params.id;

        const result = await apartmentCollection.deleteOne({
          _id: new ObjectId(id as string),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            message: "Apartment not found",
          });
        }

        res.send({
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        res.status(500).send({
          message: "Failed to delete apartment",
        });
      }
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req: Request, res: Response) => {
  res.send("🚀 DwellSpot Server is running...");
});

app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
