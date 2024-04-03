import type { TEventType, TEventTypesForm } from "@pages/apps/installation/[[...step]]";
import type { Dispatch, SetStateAction } from "react";
import type { FC } from "react";
import React, { forwardRef, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { EventTypeAppSettings } from "@calcom/app-store/_components/EventTypeAppSettingsInterface";
import type { EventTypeAppsList } from "@calcom/app-store/utils";
import type { AppCategories } from "@calcom/prisma/enums";
import type { EventTypeMetaDataSchema } from "@calcom/prisma/zod-utils";
import { Button, Form } from "@calcom/ui";
import { X } from "@calcom/ui/components/icon";

import useAppsData from "@lib/hooks/useAppsData";

type TFormType = {
  metadata: z.infer<typeof EventTypeMetaDataSchema>;
};

type ConfigureStepCardProps = {
  slug: string;
  userName: string;
  categories: AppCategories[];
  credentialId?: number;
  loading?: boolean;
  formPortalRef: React.RefObject<HTMLDivElement>;
  eventTypes: TEventType[] | undefined;
  setConfigureStep: Dispatch<SetStateAction<boolean>>;
};

type EventTypeAppSettingsFormProps = Pick<
  ConfigureStepCardProps,
  "slug" | "userName" | "categories" | "credentialId"
> & {
  eventType: TEventType;
  handleDelete: () => void;
  onSubmit: (values: z.infer<typeof EventTypeMetaDataSchema>) => void;
};

type EventTypeAppSettingsWrapperProps = Pick<
  ConfigureStepCardProps,
  "slug" | "userName" | "categories" | "credentialId"
> & {
  eventType: TEventType;
};

const EventTypeAppSettingsWrapper: FC<
  Omit<EventTypeAppSettingsWrapperProps, "handleDelete" | "onSubmit">
> = ({ slug, eventType, categories, credentialId }) => {
  const { getAppDataGetter, getAppDataSetter } = useAppsData();

  useEffect(() => {
    const appDataSetter = getAppDataSetter(slug as EventTypeAppsList, categories, credentialId);
    appDataSetter("enabled", true);
  }, []);

  return (
    <EventTypeAppSettings
      slug={slug}
      eventType={eventType}
      getAppData={getAppDataGetter(slug as EventTypeAppsList)}
      setAppData={getAppDataSetter(slug as EventTypeAppsList, categories, credentialId)}
    />
  );
};

const EventTypeAppSettingsForm = forwardRef<HTMLButtonElement, EventTypeAppSettingsFormProps>(
  function EventTypeAppSettingsForm(props, ref) {
    const { handleDelete, onSubmit, eventType } = props;

    const formMethods = useForm<TFormType>({
      defaultValues: {
        metadata: eventType?.metadata,
      },
    });

    return (
      <Form
        form={formMethods}
        id={`eventtype-${eventType.id}`}
        handleSubmit={() => {
          const data = formMethods.getValues("metadata");
          onSubmit(data);
        }}>
        <div>
          <div className="sm:border-subtle bg-default relative border p-4 dark:bg-black sm:rounded-md">
            <div>
              <span className="text-default font-semibold ltr:mr-1 rtl:ml-1">{eventType.title}</span>{" "}
              <small className="text-subtle hidden font-normal sm:inline">
                /{eventType.team ? eventType.team.slug : props.userName}/{eventType.slug}
              </small>
            </div>
            <EventTypeAppSettingsWrapper {...props} />
            <X className="absolute right-4 top-4 h-4 w-4 cursor-pointer" onClick={() => handleDelete()} />
            <button type="submit" className="hidden" ref={ref}>
              Save
            </button>
          </div>
        </div>
      </Form>
    );
  }
);

export const ConfigureStepCard: FC<ConfigureStepCardProps> = ({
  loading,
  formPortalRef,
  eventTypes,
  setConfigureStep,
  ...props
}) => {
  const { control, getValues } = useFormContext<TEventTypesForm>();
  const { fields, update } = useFieldArray({
    control,
    name: "eventTypes",
    keyName: "fieldId",
  });

  const submitRefs = useRef<Array<React.RefObject<HTMLButtonElement>>>([]);
  submitRefs.current = fields.map(
    (_ref, index) => (submitRefs.current[index] = React.createRef<HTMLButtonElement>())
  );
  const mainForSubmitRef = useRef<HTMLButtonElement>(null);
  const [updatedEventTypesStatus, setUpdatedEventTypesStatus] = useState(
    fields.filter((field) => field.selected).map((field) => ({ id: field.id, updated: false }))
  );
  const [submit, setSubmit] = useState(false);
  const allUpdated = updatedEventTypesStatus.every((item) => item.updated);

  useEffect(() => {
    setUpdatedEventTypesStatus((prev) =>
      prev.filter((state) => fields.some((field) => field.id === state.id && field.selected))
    );
    if (!fields.some((field) => field.selected)) {
      setConfigureStep(false);
    }
  }, [fields]);

  useEffect(() => {
    if (submit && allUpdated && mainForSubmitRef.current) {
      mainForSubmitRef.current?.click();
      setSubmit(false);
    }
  }, [submit, allUpdated, getValues, mainForSubmitRef]);

  return (
    formPortalRef?.current &&
    createPortal(
      <div className="mt-8">
        <div className="flex flex-col space-y-6">
          {fields.map((field, index) => {
            return (
              field.selected && (
                <EventTypeAppSettingsForm
                  key={field.fieldId}
                  eventType={field}
                  handleDelete={() => {
                    const eventMetadataDb = eventTypes?.find(
                      (eventType) => eventType.id == field.id
                    )?.metadata;
                    update(index, { ...field, selected: false, metadata: eventMetadataDb });
                  }}
                  onSubmit={(data) => {
                    update(index, { ...field, metadata: data });
                    setUpdatedEventTypesStatus((prev) => {
                      const temp = prev.map((item) =>
                        item.id === field.id ? { ...item, updated: true } : item
                      );
                      return temp;
                    });
                  }}
                  ref={submitRefs.current[index]}
                  {...props}
                />
              )
            );
          })}
        </div>

        <button form="outer-event-type-form" type="submit" className="hidden" ref={mainForSubmitRef}>
          Save
        </button>
        <Button
          className="text-md mt-6 w-full justify-center"
          type="button"
          onClick={() => {
            submitRefs.current.reverse().map((ref) => ref.current?.click());
            setSubmit(true);
          }}
          loading={loading}>
          Save
        </Button>
      </div>,
      formPortalRef?.current
    )
  );
};
