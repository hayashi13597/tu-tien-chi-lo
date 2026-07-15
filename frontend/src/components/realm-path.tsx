"use client";

import { REALM_META } from "@/lib/realm-constants";

interface RealmPathProps {
  currentRealmMajor: number;
}

export function RealmPath({ currentRealmMajor }: RealmPathProps) {
  return (
    <section className="realm-path">
      <div className="panel-title">Tu Tiên Lộ</div>
      <div className="realm-steps">
        {REALM_META.map((realm, i) => {
          let cls = "realm-step";
          if (i < currentRealmMajor) cls += " passed";
          if (i === currentRealmMajor) cls += " current";
          return (
            <div key={realm.name} className={cls}>
              <div className="realm-step-dot" />
              <div className="realm-step-name">{realm.name}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
