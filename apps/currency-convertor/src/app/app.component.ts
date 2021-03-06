import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { select, Store } from '@ngrx/store';
import { Sort } from '@angular/material';

import { CurrencyTable, RatesState } from './models/rates.model';
import { LoadRates, LoadRatesByDate } from './state/rates.actions';
import { RatesSet } from './models/rates.model';
import { AppService } from './app.service';

@Component({
  selector: 'currency-convertor-app',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  rates$: Observable<RatesState>;
  objectKeys = Object.keys;
  currencyForm: FormGroup = this.fb.group({
    sourceCurrency: [''],
    targetCurrency: [''],
    sourceValue: [''],
    requestDate: ['']
  });
  sourceCurrencyList: string[];
  targetCurrencyList: string[];
  currentSourceCurrencyName = 'EUR';
  currentTargetCurrencyName = 'USD';
  defaultDate: string;
  targetValue: number;
  dataSet: RatesSet;
  sourceValue = 1;
  currentDate = new Date();
  currentCurrencyTable: CurrencyTable = {
    displayedColumns: [],
    dataSource: []
  };
  sortedCurrencyTable: CurrencyTable = {
    displayedColumns: [],
    dataSource: []
  };
  subscription: Subscription;

  constructor(private calculator: AppService, private store: Store<RatesState>, public fb: FormBuilder) {
    this.rates$ = this.store.pipe(select('state'));
    this.subscription = this.rates$.subscribe(data => {
      this.targetCurrencyList = this.objectKeys(data.ratesSet.rates).map(key => key);
      this.sourceCurrencyList = [
        ...this.targetCurrencyList,
        data.ratesSet.base
      ];
      this.dataSet = data.ratesSet;
      this.defaultDate = data.ratesSet.date;
      this.currencyForm.controls['sourceCurrency'].setValue(this.currentSourceCurrencyName, {onlySelf: true});
      this.currencyForm.controls['targetCurrency'].setValue(this.currentTargetCurrencyName, {onlySelf: true});
      this.currencyForm.controls['requestDate'].setValue(this.defaultDate, {onlySelf: true});
      this.currencyForm.controls['sourceValue'].setValue(this.sourceValue, {onlySelf: true});
      this.targetValue = this.currencyForm.controls['sourceValue'].value*data.ratesSet.rates[this.currencyForm.controls['targetCurrency'].value];
      this.generateCurrencyTable();
    });
  }

  ngOnInit() {
    this.store.dispatch(new LoadRates());

    // Process number change
    this.subscription.add(this.currencyForm.controls['sourceValue'].valueChanges.subscribe(change => {
      this.sourceValue = change;
      this.targetValue = change*this.dataSet.rates[this.currentTargetCurrencyName];
    }));

    // Process source currency change
    this.subscription.add(this.currencyForm.controls['sourceCurrency'].valueChanges.subscribe(change => {
      this.dataSet = this.calculator.getRatesByAnotherBase(this.dataSet, change);
      // In target list remove new currency to avoid repetition
      this.targetCurrencyList = this.targetCurrencyList.filter(
        item => change !== item
      );
      // Check if currency is flipped and replace it
      if (this.currencyForm.controls['targetCurrency'].value === change) {
        this.targetCurrencyList.push(this.currentSourceCurrencyName);
        this.currencyForm.controls['targetCurrency'].setValue(this.currentSourceCurrencyName, {onlySelf: true});
        this.currentTargetCurrencyName = this.currentSourceCurrencyName;
      }
      // Reference current chosen currency in component
      this.currentSourceCurrencyName = change;
      // Change calculation if any
      this.targetValue = this.sourceValue*this.dataSet.rates[this.currencyForm.controls['targetCurrency'].value];
      this.generateCurrencyTable();
    }));

    // Process target currency change
    this.subscription.add(this.currencyForm.controls['targetCurrency'].valueChanges.subscribe(change => {
      this.targetValue = this.sourceValue*this.dataSet.rates[this.currencyForm.controls['targetCurrency'].value];
      this.currentTargetCurrencyName = change;
    }));

    // Process date change
    this.subscription.add(this.currencyForm.controls['requestDate'].valueChanges.subscribe(change => {
      const oldValue = this.dataSet.date;
      const newValue = new Date(change).toISOString().substring(0, 10);
      if (newValue && newValue !== oldValue) this.store.dispatch(new LoadRatesByDate(
        {
          ...this.dataSet,
          date: newValue,
          base: this.currentSourceCurrencyName
        }
      ));
    }));
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  swapCurrencies() {
    this.currencyForm.controls['sourceCurrency'].setValue(this.currentTargetCurrencyName);
  }

  sortData(sort: Sort): void {
    const data = this.currentCurrencyTable.dataSource.slice();
    if (!sort.active || sort.direction === '') {
      this.sortedCurrencyTable.dataSource = data;
      return;
    }

    this.sortedCurrencyTable.dataSource = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'code': return this.compare(a.code, b.code, isAsc);
        case 'value': return this.compare(a.value, b.value, isAsc);
        default: return 0;
      }
    });
  }

  private compare(a: number | string, b: number | string, isAsc: boolean): number {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }

  private generateCurrencyTable(): void {
    this.currentCurrencyTable.displayedColumns = ['code', 'value'];

    this.currentCurrencyTable.dataSource = this.objectKeys(this.dataSet.rates).map(key => {
      return { code: key, value: this.dataSet.rates[key] };
    });
    this.sortedCurrencyTable = this.currentCurrencyTable;
  }
}
