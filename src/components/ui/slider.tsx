import * as React from 'react';
import {Slider as SliderPrimitive} from 'radix-ui';
import {cn} from '@/lib/utils';

function Slider({className,...props}:React.ComponentProps<typeof SliderPrimitive.Root>){
 return <SliderPrimitive.Root className={cn('relative flex w-full touch-none select-none items-center py-2 data-[disabled]:opacity-50',className)} {...props}>
  <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-blue-100"><SliderPrimitive.Range className="absolute h-full bg-blue-600"/></SliderPrimitive.Track>
  <SliderPrimitive.Thumb aria-label="장면 미리보기 시점" className="block size-4 rounded-full border-2 border-blue-600 bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"/>
 </SliderPrimitive.Root>;
}
export {Slider};
