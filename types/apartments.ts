import { ObjectId } from "mongodb";

export interface Apartment {
  _id?: ObjectId;
  title: string;
  description: string;
  location: string;
  image: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  type: string;
  status: string; 
  createdAt: string;
}