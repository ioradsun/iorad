import React, { createContext, useContext, useState, useCallback } from "react";
import type { Customer } from "@/data/customers";

interface StoryEditContextType {
  isEditing: boolean;
  editedCustomer: Customer;
  setField: (path: string, value: any) => void;
  removeFromArray: (path: string, index: number) => void;
  startEditing: () => void;
  cancelEditing: () => void;
  isSaving: boolean;
  setIsSaving: (v: boolean) => void;
}

const StoryEditContext = createContext<StoryEditContextType | null>(null);

export function useStoryEdit() {
  return useContext(StoryEditContext);
}

function setNestedField(obj: any, path: string, value: any): any {
  const keys = path.split(".");
  const clone = structuredClone(obj);
  let current = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i];
    current = current[key];
  }
  const lastKey = /^\d+$/.test(keys[keys.length - 1]) ? Number(keys[keys.length - 1]) : keys[keys.length - 1];
  current[lastKey] = value;
  return clone;
}

function removeNestedArrayItem(obj: any, path: string, index: number): any {
  const keys = path.split(".");
  const clone = structuredClone(obj);
  let current = clone;
  for (let i = 0; i < keys.length; i++) {
    const key = /^\d+$/.test(keys[i]) ? Number(keys[i]) : keys[i];
    if (i === keys.length - 1) {
      if (Array.isArray(current[key])) {
        current[key].splice(index, 1);
      }
    } else {
      current = current[key];
    }
  }
  return clone;
}

interface Props {
  customer: Customer;
  children: React.ReactNode;
}

export function StoryEditProvider({ customer, children }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Customer>(customer);
  const [isSaving, setIsSaving] = useState(false);

  const startEditing = useCallback(() => {
    setEditedCustomer(structuredClone(customer));
    setIsEditing(true);
  }, [customer]);

  const cancelEditing = useCallback(() => {
    setEditedCustomer(structuredClone(customer));
    setIsEditing(false);
  }, [customer]);

  const setField = useCallback((path: string, value: any) => {
    setEditedCustomer((prev) => setNestedField(prev, path, value));
  }, []);

  const removeFromArray = useCallback((path: string, index: number) => {
    setEditedCustomer((prev) => removeNestedArrayItem(prev, path, index));
  }, []);

  return (
    <StoryEditContext.Provider value={{ isEditing, editedCustomer, setField, removeFromArray, startEditing, cancelEditing, isSaving, setIsSaving }}>
      {children}
    </StoryEditContext.Provider>
  );
}
