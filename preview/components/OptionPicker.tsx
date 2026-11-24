'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Select } from 'radix-ui';
import { useId } from 'react';

export function OptionPicker({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return <div className="pv-picker">
    <label htmlFor={id}>{label}</label>
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger id={id} className="pv-picker-trigger">
        <Select.Value placeholder="선택해 주세요" />
        <Select.Icon><ChevronDown size={17} aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" align="start" sideOffset={6} className="pv-picker-content">
          <Select.Viewport>
            {options.map(option => <Select.Item className="pv-picker-item" key={option.value} value={option.value}>
              <Select.ItemText>{option.label}</Select.ItemText>
              <Select.ItemIndicator><Check size={16} aria-hidden="true" /></Select.ItemIndicator>
            </Select.Item>)}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  </div>;
}
